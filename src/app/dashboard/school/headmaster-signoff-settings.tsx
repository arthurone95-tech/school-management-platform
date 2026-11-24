"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SchoolProfile, SignOffMode } from "@/lib/administration/types";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 160;

const MODE_LABELS: ReadonlyArray<{
  readonly value: SignOffMode;
  readonly title: string;
  readonly description: string;
}> = [
  {
    value: "image",
    title: "Cropped image",
    description: "Upload a signature image and crop it in the browser.",
  },
  {
    value: "stamp",
    title: "Name & title stamp",
    description: "Print the signatory name, title, date, and confirmed status.",
  },
  {
    value: "draw",
    title: "Draw directly on screen",
    description: "Draw with a mouse, touch screen, or trackpad.",
  },
];

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || payload["ok"] !== true) {
    const error = payload["error"];
    return {
      ok: false,
      message: typeof error === "string" ? error : "The change could not be saved.",
    };
  }
  return { ok: true, data: payload };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function ImageCropper({
  onCropped,
}: {
  readonly onCropped: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const limits = useCallback(() => {
    const image = imageRef.current;
    if (!image) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const scale =
      Math.max(CANVAS_WIDTH / image.width, CANVAS_HEIGHT / image.height) * zoom;
    return {
      minX: CANVAS_WIDTH - image.width * scale,
      maxX: 0,
      minY: CANVAS_HEIGHT - image.height * scale,
      maxY: 0,
    };
  }, [zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale =
      Math.max(CANVAS_WIDTH / image.width, CANVAS_HEIGHT / image.height) * zoom;
    const bound = limits();
    const x = clamp(offset.x, bound.minX, bound.maxX);
    const y = clamp(offset.y, bound.minY, bound.maxY);
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.drawImage(image, x, y, image.width * scale, image.height * scale);
  }, [limits, offset.x, offset.y, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("The image must be 2 MB or smaller.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        imageRef.current = image;
        setHasImage(true);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="stack stack--sm">
      <label className="btn btn--secondary btn--sm">
        Choose signature image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="input--hidden"
        />
      </label>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Signature crop area"
        style={{
          maxWidth: "100%",
          border: "1px dashed #999",
          touchAction: "none",
          cursor: hasImage ? "grab" : "default",
        }}
        onPointerDown={(event) => {
          if (!imageRef.current) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            left: offset.x,
            top: offset.y,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const bound = limits();
          setOffset({
            x: clamp(drag.left + event.clientX - drag.x, bound.minX, bound.maxX),
            y: clamp(drag.top + event.clientY - drag.y, bound.minY, bound.maxY),
          });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      />
      <label className="cluster" style={{ alignItems: "center" }}>
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(event) => {
            const nextZoom = Number(event.target.value);
            const bound = limits();
            const ratio = nextZoom / zoom;
            setZoom(nextZoom);
            setOffset({
              x: clamp(offset.x * ratio, bound.minX, bound.maxX),
              y: clamp(offset.y * ratio, bound.minY, bound.maxY),
            });
          }}
          disabled={!hasImage}
        />
      </label>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!hasImage}
        onClick={() => {
          const canvas = canvasRef.current;
          if (canvas) onCropped(canvas.toDataURL("image/png"));
        }}
      >
        Use cropped signature
      </Button>
    </div>
  );
}

function DrawingPad({ onSave }: { readonly onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  function prepareContext(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111";
    return context;
  }

  return (
    <div className="stack stack--sm">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Draw your signature here"
        style={{
          maxWidth: "100%",
          border: "1px dashed #999",
          touchAction: "none",
          cursor: "crosshair",
          background: "#fff",
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const context = prepareContext();
          const point = position(event);
          if (!context) return;
          context.beginPath();
          context.moveTo(point.x, point.y);
          drawingRef.current = true;
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          const context = prepareContext();
          const point = position(event);
          if (!context) return;
          context.lineTo(point.x, point.y);
          context.stroke();
        }}
        onPointerUp={() => {
          drawingRef.current = false;
          canvasRef.current?.getContext("2d")?.closePath();
        }}
      />
      <div className="cluster">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const canvas = canvasRef.current;
            canvas?.getContext("2d")?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          }}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) onSave(canvas.toDataURL("image/png"));
          }}
        >
          Save drawing
        </Button>
      </div>
    </div>
  );
}

export function HeadmasterSignoffSettings({
  profile,
  canManage,
  onSaved,
}: {
  readonly profile: SchoolProfile;
  readonly canManage: boolean;
  readonly onSaved: (school: SchoolProfile) => void;
}) {
  const [mode, setMode] = useState<SignOffMode>(profile.signOffMode ?? "image");
  const [signatoryName, setSignatoryName] = useState(profile.headmasterName ?? "");
  const [signatoryTitle, setSignatoryTitle] = useState(
    profile.headmasterTitle ?? "Headmaster",
  );
  const [signatureUrl, setSignatureUrl] = useState<string | null>(
    profile.headmasterSignatureUrl ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function persist(next?: { readonly signatureUrl?: string | null }) {
    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await postJson("/api/staff/school/update", {
      name: profile.name,
      signOffMode: mode,
      headmasterName: signatoryName.trim(),
      headmasterTitle: signatoryTitle.trim(),
      headmasterSignatureUrl:
        next?.signatureUrl !== undefined ? next.signatureUrl : signatureUrl,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const school = result.data["school"] as SchoolProfile | undefined;
    if (school) onSaved(school);
    setNotice("Headmaster sign-off settings saved.");
  }

  async function uploadSignature(dataUrl: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await postJson("/api/staff/school/signature", { dataUrl });
    if (!result.ok) {
      setSaving(false);
      setError(result.message);
      return;
    }
    const url = typeof result.data["url"] === "string" ? result.data["url"] : null;
    if (!url) {
      setSaving(false);
      setError("The signature URL could not be read.");
      return;
    }
    setSignatureUrl(url);
    await persist({ signatureUrl: url });
  }

  return (
    <div className="stack stack--sm">
      <fieldset disabled={!canManage || saving} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
          Headmaster sign-off mode
        </legend>
        <div className="stack stack--sm">
          {MODE_LABELS.map((option) => (
            <label className="cluster" key={option.value} style={{ alignItems: "flex-start" }}>
              <input
                type="radio"
                name="signOffMode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
              />
              <span>
                <strong>{option.title}</strong>
                <br />
                <span className="muted">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="cluster cluster--wide">
          <label className="stack stack--sm" style={{ flex: "1 1 220px" }}>
            <span>Signatory name</span>
            <input
              className="input"
              value={signatoryName}
              onChange={(event) => setSignatoryName(event.target.value)}
              maxLength={120}
              placeholder="e.g. Ama Mensah"
            />
          </label>
          <label className="stack stack--sm" style={{ flex: "1 1 180px" }}>
            <span>Signatory title</span>
            <input
              className="input"
              value={signatoryTitle}
              onChange={(event) => setSignatoryTitle(event.target.value)}
              maxLength={80}
              placeholder="e.g. Headteacher"
            />
          </label>
        </div>

        {mode === "image" ? <ImageCropper onCropped={uploadSignature} /> : null}
        {mode === "draw" ? <DrawingPad onSave={uploadSignature} /> : null}

        {mode === "stamp" ? (
          <div
            className="report-card-signoff report-card-signoff--stamp"
            style={{ border: "2px solid #111", padding: "12px", maxWidth: "360px" }}
          >
            <strong style={{ textTransform: "uppercase" }}>
              {signatoryName || "Signatory name"}
            </strong>
            <br />
            <span>{signatoryTitle || "Title"}</span>
            <br />
            <span className="muted">Confirmed • {new Date().toLocaleDateString("en-GB")}</span>
          </div>
        ) : signatureUrl ? (
          <img
            src={signatureUrl}
            alt="Headmaster signature preview"
            className="report-card-signoff-image"
            style={{ maxHeight: "48px", filter: "grayscale(1) contrast(2)" }}
          />
        ) : (
          <p className="muted">No signature saved yet.</p>
        )}

        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        <Button
          type="button"
          size="sm"
          loading={saving}
          onClick={() => void persist()}
        >
          {saving ? "Saving..." : "Save sign-off settings"}
        </Button>
      </fieldset>
    </div>
  );
}
