/**
 * Frame fan-out for the radio sim worker → React canvas.
 *
 * Important: worker dispose/reboot must clear the latest frame but MUST NOT
 * drop the subscriber — RadioSimPreview stays mounted across auto-recover and
 * only unsubscribes on unmount. Clearing the subscriber freezes the UI on
 * lastGoodFrame until radio preview is toggled.
 */
import type { SimFrameData } from "@widget-gen/sim-preview";

export type FrameSubscriber = (frame: SimFrameData) => void;

export class RadioSimFrameHub {
  private subscriber: FrameSubscriber | null = null;
  private latest: SimFrameData | null = null;

  subscribe(subscriber: FrameSubscriber | null): void {
    this.subscriber = subscriber;
    if (subscriber && this.latest) {
      subscriber(this.latest);
    }
  }

  publish(frame: SimFrameData): void {
    this.latest = frame;
    this.subscriber?.(frame);
  }

  /** Call when the worker is disposed — keep the React subscription alive. */
  clearLatest(): void {
    this.latest = null;
  }

  get hasSubscriber(): boolean {
    return this.subscriber != null;
  }

  get latestFrame(): SimFrameData | null {
    return this.latest;
  }
}
