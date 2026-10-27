"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compileExpression, type AngleMode } from "@/lib/calculator";

export type GraphFunction = {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
};

type View = { centerX: number; centerY: number; scale: number };

const initialView: View = { centerX: 0, centerY: 0, scale: 42 };

export function GraphCanvas({
  functions,
  angleMode,
  resetSignal,
}: {
  functions: GraphFunction[];
  angleMode: AngleMode;
  resetSignal: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(initialView);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinch = useRef<number | null>(null);
  const hoverX = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 600, height: 430 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(280, entry.contentRect.width),
        height: Math.max(340, entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(dpr, dpr);

    const styles = getComputedStyle(canvas);
    const background = styles.getPropertyValue("--graph-bg").trim() || "#181613";
    const grid = styles.getPropertyValue("--graph-grid").trim() || "#2a2521";
    const axis = styles.getPropertyValue("--graph-axis").trim() || "#7d7063";
    const label = styles.getPropertyValue("--muted").trim() || "#a09282";
    const surface = styles.getPropertyValue("--surface").trim() || "#1e1b18";
    const foreground = styles.getPropertyValue("--foreground").trim() || "#f3ece2";
    const mono = styles.getPropertyValue("--font-mono").trim() || "monospace";
    context.fillStyle = background;
    context.fillRect(0, 0, size.width, size.height);

    const view = viewRef.current;
    const toScreenX = (x: number) =>
      size.width / 2 + (x - view.centerX) * view.scale;
    const toScreenY = (y: number) =>
      size.height / 2 - (y - view.centerY) * view.scale;
    const fromScreenX = (x: number) =>
      (x - size.width / 2) / view.scale + view.centerX;

    const targetStep = 72 / view.scale;
    const power = 10 ** Math.floor(Math.log10(targetStep));
    const normalized = targetStep / power;
    const worldStep =
      (normalized < 2 ? 2 : normalized < 5 ? 5 : 10) * power;
    const pixelStep = worldStep * view.scale;
    const xAxis = toScreenY(0);
    const yAxis = toScreenX(0);

    context.lineWidth = 1;
    context.strokeStyle = grid;
    context.fillStyle = label;
    context.font = `11px ${mono}`;
    context.textAlign = "center";
    context.textBaseline = "top";

    const firstX = yAxis % pixelStep;
    for (let x = firstX; x <= size.width; x += pixelStep) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, size.height);
      context.stroke();
      const value = fromScreenX(x);
      if (Math.abs(value) > worldStep / 10) {
        context.fillText(
          Number(value.toPrecision(4)).toString(),
          x,
          Math.min(size.height - 16, Math.max(4, xAxis + 6)),
        );
      }
    }

    const firstY = xAxis % pixelStep;
    context.textAlign = "left";
    context.textBaseline = "middle";
    for (let y = firstY; y <= size.height; y += pixelStep) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(size.width, y);
      context.stroke();
      const value = view.centerY + (size.height / 2 - y) / view.scale;
      if (Math.abs(value) > worldStep / 10) {
        context.fillText(
          Number(value.toPrecision(4)).toString(),
          Math.min(size.width - 42, Math.max(5, yAxis + 7)),
          y,
        );
      }
    }

    context.strokeStyle = axis;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, xAxis);
    context.lineTo(size.width, xAxis);
    context.moveTo(yAxis, 0);
    context.lineTo(yAxis, size.height);
    context.stroke();

    const readouts: { color: string; y: number }[] = [];
    for (const item of functions) {
      if (!item.visible || !item.expression.trim()) continue;
      let evaluate: (x: number) => number;
      try {
        evaluate = compileExpression(item.expression, angleMode);
      } catch {
        continue;
      }
      if (hoverX.current !== null) {
        readouts.push({ color: item.color, y: evaluate(fromScreenX(hoverX.current)) });
      }
      context.strokeStyle = item.color;
      context.lineWidth = 2.5;
      context.lineJoin = "round";
      context.beginPath();
      let drawing = false;
      let previousY = 0;
      for (let px = 0; px <= size.width; px += 1.5) {
        const y = evaluate(fromScreenX(px));
        const py = toScreenY(y);
        const discontinuity =
          !Number.isFinite(py) ||
          py < -size.height * 3 ||
          py > size.height * 4 ||
          (drawing && Math.abs(py - previousY) > size.height * 0.8);
        if (discontinuity) {
          drawing = false;
          continue;
        }
        if (!drawing) context.moveTo(px, py);
        else context.lineTo(px, py);
        drawing = true;
        previousY = py;
      }
      context.stroke();
    }

    // Meelezen: verticale lijn op de muispositie met de y-waarde van elke functie.
    const hx = hoverX.current;
    if (hx !== null) {
      context.save();
      context.setLineDash([4, 4]);
      context.strokeStyle = axis;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(hx, 0);
      context.lineTo(hx, size.height);
      context.stroke();
      context.restore();

      const lines = [`x = ${Number(fromScreenX(hx).toPrecision(4))}`];
      for (const readout of readouts) {
        if (!Number.isFinite(readout.y)) continue;
        const py = toScreenY(readout.y);
        context.fillStyle = background;
        context.strokeStyle = readout.color;
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(hx, py, 5, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        lines.push(`y = ${Number(readout.y.toPrecision(4))}`);
      }

      context.font = `600 12px ${mono}`;
      const width = Math.max(...lines.map((line) => context.measureText(line).width)) + 30;
      const height = lines.length * 18 + 12;
      const boxX = hx + 14 + width > size.width ? hx - 14 - width : hx + 14;
      context.fillStyle = surface;
      context.strokeStyle = grid;
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(boxX, 12, width, height, 10);
      context.fill();
      context.stroke();
      context.textAlign = "left";
      context.textBaseline = "middle";
      lines.forEach((line, index) => {
        const y = 12 + 15 + index * 18;
        if (index > 0) {
          context.fillStyle = readouts.filter((r) => Number.isFinite(r.y))[index - 1].color;
          context.beginPath();
          context.arc(boxX + 12, y, 4, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = index === 0 ? label : foreground;
        context.fillText(line, boxX + 22, y);
      });
    }
  }, [angleMode, functions, size]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    viewRef.current = { ...initialView };
    draw();
  }, [draw, resetSignal]);

  const zoomAt = (factor: number, x: number, y: number) => {
    const view = viewRef.current;
    const worldX = (x - size.width / 2) / view.scale + view.centerX;
    const worldY = view.centerY - (y - size.height / 2) / view.scale;
    const nextScale = Math.min(500, Math.max(8, view.scale * factor));
    viewRef.current = {
      centerX: worldX - (x - size.width / 2) / nextScale,
      centerY: worldY + (y - size.height / 2) / nextScale,
      scale: nextScale,
    };
    draw();
  };

  return (
    <div ref={containerRef} className="graph-wrap">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        style={{ width: size.width, height: size.height }}
        aria-label="Interactive function graph"
        onWheel={(event) => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          zoomAt(
            event.deltaY < 0 ? 1.12 : 0.89,
            event.clientX - bounds.left,
            event.clientY - bounds.top,
          );
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) {
            if (event.pointerType === "mouse") {
              hoverX.current = event.clientX - event.currentTarget.getBoundingClientRect().left;
              draw();
            }
            return;
          }
          hoverX.current = null;
          const active = pointers.current;
          active.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (active.size === 1) {
            const view = viewRef.current;
            viewRef.current = {
              ...view,
              centerX: view.centerX - (event.clientX - previous.x) / view.scale,
              centerY: view.centerY + (event.clientY - previous.y) / view.scale,
            };
            draw();
          } else if (active.size === 2) {
            const [a, b] = [...active.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (lastPinch.current) {
              const bounds = event.currentTarget.getBoundingClientRect();
              zoomAt(
                distance / lastPinch.current,
                (a.x + b.x) / 2 - bounds.left,
                (a.y + b.y) / 2 - bounds.top,
              );
            }
            lastPinch.current = distance;
          }
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          lastPinch.current = null;
        }}
        onPointerLeave={() => {
          hoverX.current = null;
          draw();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          lastPinch.current = null;
        }}
      />
    </div>
  );
}
