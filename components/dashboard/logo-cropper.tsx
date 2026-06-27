"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, ZoomIn, Trash2 } from "lucide-react";

/** Pan + zoom logo cropper. The founder drags to position and zooms to crop out
 *  deadspace; on every settle we render the visible frame to a transparent PNG
 *  and hand it back via onCropped, so the parent form uploads the tight logo. */
const FRAME_W = 320; // display px
const OUT_W = 640; // exported px (≈2× for retina)
const ASPECTS: { label: string; value: number }[] = [
  { label: "Wide 3:1", value: 3 },
  { label: "2:1", value: 2 },
  { label: "Square", value: 1 },
];

export function LogoCropper({
  currentLogoUrl,
  onCropped,
}: {
  currentLogoUrl?: string | null;
  onCropped: (file: File | null) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const frameH = FRAME_W / aspect;
  const baseScale = img ? Math.min(FRAME_W / img.naturalWidth, frameH / img.naturalHeight) : 1;
  const effScale = baseScale * zoom;

  // Center the image whenever a new image loads or the aspect changes.
  const recenter = useCallback(
    (image: HTMLImageElement, asp: number, z: number) => {
      const fh = FRAME_W / asp;
      const s = Math.min(FRAME_W / image.naturalWidth, fh / image.naturalHeight) * z;
      setOffset({ x: (FRAME_W - image.naturalWidth * s) / 2, y: (fh - image.naturalHeight * s) / 2 });
    },
    []
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setSrc(url);
      setZoom(1);
      recenter(image, aspect, 1);
    };
    image.src = url;
  }

  // Render the framed region to a transparent PNG and hand it up.
  const commit = useCallback(() => {
    if (!img) return;
    const fh = FRAME_W / aspect;
    const outH = Math.round(OUT_W / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = -offset.x / effScale;
    const sy = -offset.y / effScale;
    const sW = FRAME_W / effScale;
    const sH = fh / effScale;
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, OUT_W, outH);
    canvas.toBlob((blob) => {
      if (blob) onCropped(new File([blob], "logo.png", { type: "image/png" }));
    }, "image/png");
  }, [img, aspect, offset, effScale, onCropped]);

  // Re-commit shortly after any settle (pointer up / zoom / aspect change).
  useEffect(() => {
    if (!img) return;
    const t = setTimeout(commit, 150);
    return () => clearTimeout(t);
  }, [img, offset, zoom, aspect, commit]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  }
  function onPointerUp() {
    drag.current = null;
  }

  function changeZoom(z: number) {
    // Zoom toward the frame centre so the framed content stays put.
    const fh = FRAME_W / aspect;
    const oldS = baseScale * zoom;
    const newS = baseScale * z;
    const cx = FRAME_W / 2, cy = fh / 2;
    setOffset((o) => ({ x: cx - ((cx - o.x) * newS) / oldS, y: cy - ((cy - o.y) * newS) / oldS }));
    setZoom(z);
  }

  function changeAspect(a: number) {
    setAspect(a);
    if (img) recenter(img, a, zoom);
  }

  function remove() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setImg(null);
    if (fileRef.current) fileRef.current.value = "";
    onCropped(null);
  }

  if (!src) {
    return (
      <div>
        {currentLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentLogoUrl} alt="Current logo" className="mb-2 h-12 w-auto max-w-[200px] rounded bg-white object-contain p-1 ring-1 ring-gray-200" />
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ImageUp className="h-4 w-4" /> {currentLogoUrl ? "Replace logo" : "Choose logo"}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={onPick} />
        </label>
        <p className="mt-1 text-xs text-gray-400">
          PNG or SVG on a transparent background, under 2MB. You can crop out deadspace after choosing.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {ASPECTS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => changeAspect(a.value)}
            className={`rounded-md border px-2 py-1 text-xs font-medium ${aspect === a.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div
        className="relative mt-2 touch-none overflow-hidden rounded-lg border border-gray-300"
        style={{
          width: FRAME_W,
          height: frameH,
          backgroundImage:
            "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
            style={{
              width: img.naturalWidth * effScale,
              height: img.naturalHeight * effScale,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
      </div>

      <div className="mt-2 flex items-center gap-2" style={{ width: FRAME_W }}>
        <ZoomIn className="h-4 w-4 text-gray-400" />
        <input
          type="range"
          min={1}
          max={5}
          step={0.01}
          value={zoom}
          onChange={(e) => changeZoom(parseFloat(e.target.value))}
          className="flex-1"
        />
        <button type="button" onClick={remove} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove logo">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">Drag to position, slide to zoom — crop out any deadspace. Saved when you finalise.</p>
    </div>
  );
}
