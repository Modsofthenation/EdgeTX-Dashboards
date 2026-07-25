#!/usr/bin/env node
import { assertNodeVersion } from "./nodeVersion.ts";
import { WidgetGenerator, CursorAgentError } from "./agent.ts";

const PROTOCOLS = new Set(["betaflight", "rotorflight", "generic-crsf"]);

export interface GenerateCliFlags {
  radio: string;
  protocol: "betaflight" | "rotorflight" | "generic-crsf";
  edgeTx: string;
  prompt: string;
}

/**
 * Parse widget-gen CLI args. Also recovers when nested npm strips `--protocol`
 * / `--radio` and leaves bare tokens as positionals.
 */
export function parseGenerateCliArgs(args: string[]): GenerateCliFlags | null {
  const flags = {
    radio: "tx15",
    protocol: "betaflight" as GenerateCliFlags["protocol"],
    edgeTx: "2.11.0",
  };
  let protocolExplicit = false;
  let radioExplicit = false;

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--radio" && args[i + 1]) {
      flags.radio = args[++i];
      radioExplicit = true;
    } else if (args[i] === "--protocol" && args[i + 1]) {
      flags.protocol = args[++i] as GenerateCliFlags["protocol"];
      protocolExplicit = true;
    } else if (args[i] === "--edge-tx" && args[i + 1]) {
      flags.edgeTx = args[++i];
    } else if (!args[i].startsWith("--")) {
      positional.push(args[i]);
    }
  }

  // Defense: nested `npm run` sometimes eats `--protocol`/`--radio` and leaves
  // bare tokens first in the prompt (`rotorflight tx15 …`).
  if (!protocolExplicit && positional.length > 0 && PROTOCOLS.has(positional[0])) {
    flags.protocol = positional.shift() as GenerateCliFlags["protocol"];
  }
  if (
    !radioExplicit &&
    positional.length > 0 &&
    /^tx\d+/i.test(positional[0])
  ) {
    flags.radio = positional.shift()!;
  }

  const prompt = positional.join(" ").trim();
  if (!prompt) return null;

  return { ...flags, prompt };
}

async function main(): Promise<void> {
  assertNodeVersion();
  const parsed = parseGenerateCliArgs(process.argv.slice(2));
  if (!parsed) {
    console.error(`Usage: widget-gen [options] "<prompt>"

Options:
  --radio <id>       Radio profile (default: tx15)
  --protocol <name>  betaflight | rotorflight | generic-crsf
  --edge-tx <ver>    EdgeTX version (default: 2.11.0)

Requires CURSOR_API_KEY environment variable.`);
    process.exit(1);
  }

  const gen = new WidgetGenerator();

  try {
    await gen.createAgent();
    console.error(`Agent: ${gen.agentId}`);
    console.error(
      `Generating widget for ${parsed.radio} / ${parsed.protocol}...\n`,
    );

    const result = await gen.generate(
      {
        prompt: parsed.prompt,
        radioId: parsed.radio,
        protocol: parsed.protocol,
        edgeTxVersion: parsed.edgeTx,
      },
      {
        onEvent: (ev) => {
          if (ev.type === "text") {
            process.stdout.write(ev.content);
          } else if (ev.type === "tool" || ev.type === "status") {
            process.stderr.write(`${ev.content}\n`);
          }
        },
      },
    );

    console.error(`\nStatus: ${result.status}`);
    if (result.widgetName) {
      console.error(`Widget: ${result.widgetName}`);
      console.error(`Download zip: dist-output/${result.widgetName}.zip`);
    }

    if (!result.success) {
      process.exit(2);
    }
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(
        `Startup failed: ${err.message} (retryable=${err.isRetryable})`,
      );
      process.exit(1);
    }
    throw err;
  } finally {
    await gen.dispose();
  }
}

const isMain =
  process.argv[1]?.includes("cli.ts") || process.argv[1]?.endsWith("/cli.js");

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}