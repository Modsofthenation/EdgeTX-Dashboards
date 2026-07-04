#!/usr/bin/env node
import { assertNodeVersion } from "./nodeVersion.js";
import { WidgetGenerator, CursorAgentError } from "./agent.js";

async function main(): Promise<void> {
  assertNodeVersion();
  const args = process.argv.slice(2);
  const flags = {
    radio: "tx15",
    protocol: "betaflight" as "betaflight" | "rotorflight" | "generic-crsf",
    edgeTx: "2.11.0",
  };

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--radio" && args[i + 1]) {
      flags.radio = args[++i];
    } else if (args[i] === "--protocol" && args[i + 1]) {
      flags.protocol = args[++i] as typeof flags.protocol;
    } else if (args[i] === "--edge-tx" && args[i + 1]) {
      flags.edgeTx = args[++i];
    } else if (!args[i].startsWith("--")) {
      positional.push(args[i]);
    }
  }

  const prompt = positional.join(" ");
  if (!prompt) {
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
    console.error(`Generating widget for ${flags.radio} / ${flags.protocol}...\n`);

    const result = await gen.generate(
      {
        prompt,
        radioId: flags.radio,
        protocol: flags.protocol,
        edgeTxVersion: flags.edgeTx,
      },
      {
        onEvent: (ev) => {
          if (ev.type === "text") {
            process.stdout.write(ev.content);
          } else if (ev.type === "tool" || ev.type === "status") {
            process.stderr.write(`${ev.content}\n`);
          }
        },
      }
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
      console.error(`Startup failed: ${err.message} (retryable=${err.isRetryable})`);
      process.exit(1);
    }
    throw err;
  } finally {
    await gen.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
