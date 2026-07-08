import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Hand,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Type,
} from 'lucide-react';
import { Button, Modal } from '@/design-system/components';
import { CommentWritingAssist } from '@/modules/inspections/components/CommentWritingAssist';
import { cn } from '@/lib/cn';

type EditorTool = 'pan' | 'arrow' | 'pen' | 'text';
type EditorColor = '#e53935' | '#fdd835' | '#ffffff';

interface Point {
  x: number;
  y: number;
}

interface PenStroke {
  id: string;
  color: EditorColor;
  width: number;
  points: Point[];
}

interface ArrowShape {
  id: string;
  color: EditorColor;
  from: Point;
  to: Point;
}

interface TextShape {
  id: string;
  color: EditorColor;
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

type EditorAction =
  | { kind: 'pen'; stroke: PenStroke }
  | { kind: 'arrow'; arrow: ArrowShape }
  | { kind: 'text'; text: TextShape };

const COLORS: { value: EditorColor; label: string }[] = [
  { value: '#e53935', label: 'Red' },
  { value: '#fdd835', label: 'Yellow' },
  { value: '#ffffff', label: 'White' },
];

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, lineWidth = 4) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = Math.max(14, lineWidth * 4);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function drawPenStroke(ctx: CanvasRenderingContext2D, stroke: PenStroke) {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

function drawOutlinedText(ctx: CanvasRenderingContext2D, shape: TextShape) {
  const { text, x, y, color, fontSize } = shape;
  ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(2, fontSize / 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function canvasToDisplay(
  point: Point,
  imageMeta: { width: number; height: number },
  displayWidth: number,
  displayHeight: number,
): Point {
  return {
    x: (point.x / imageMeta.width) * displayWidth,
    y: (point.y / imageMeta.height) * displayHeight,
  };
}

function clientToCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function measureTextBox(
  ctx: CanvasRenderingContext2D,
  shape: TextShape,
): { width: number; height: number } {
  ctx.font = `600 ${shape.fontSize}px Arial, Helvetica, sans-serif`;
  const lines = shape.text.split('\n');
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width), 1);
  const lineHeight = shape.fontSize * 1.25;
  return { width, height: lines.length * lineHeight };
}

function findTextAtPoint(actions: EditorAction[], point: Point, canvas: HTMLCanvasElement): TextShape | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    if (action.kind !== 'text') continue;
    const { text } = action;
    const { width, height } = measureTextBox(ctx, text);
    const padding = Math.max(8, text.fontSize * 0.35);
    if (
      point.x >= text.x - padding &&
      point.x <= text.x + width + padding &&
      point.y >= text.y - padding &&
      point.y <= text.y + height + padding
    ) {
      return text;
    }
  }
  return null;
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  actions: EditorAction[],
  draft?: {
    pen?: PenStroke;
    arrow?: { from: Point; to: Point; color: EditorColor };
  },
  options?: { includeText?: boolean },
) {
  const includeText = options?.includeText !== false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(image, 0, 0);
  for (const action of actions) {
    if (action.kind === 'pen') drawPenStroke(ctx, action.stroke);
    if (action.kind === 'arrow') drawArrow(ctx, action.arrow.from, action.arrow.to, action.arrow.color);
    if (action.kind === 'text' && includeText) drawOutlinedText(ctx, action.text);
  }
  if (draft?.pen) drawPenStroke(ctx, draft.pen);
  if (draft?.arrow) drawArrow(ctx, draft.arrow.from, draft.arrow.to, draft.arrow.color);
}

function textActions(actions: EditorAction[]): TextShape[] {
  return actions.filter((action): action is { kind: 'text'; text: TextShape } => action.kind === 'text').map((a) => a.text);
}

export interface PhotoAnnotationEditorProps {
  open: boolean;
  dataUrl: string;
  title?: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export function PhotoAnnotationEditor({
  open,
  dataUrl,
  title = 'Edit photo',
  onClose,
  onSave,
}: PhotoAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const actionsRef = useRef<EditorAction[]>([]);

  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<EditorTool>('arrow');
  const [color, setColor] = useState<EditorColor>('#e53935');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [actions, setActions] = useState<EditorAction[]>([]);
  const [draftPen, setDraftPen] = useState<PenStroke | null>(null);
  const [draftArrow, setDraftArrow] = useState<{ from: Point; to: Point; color: EditorColor } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  const [textDraft, setTextDraft] = useState('');
  const [textPlacement, setTextPlacement] = useState<Point | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textDrag, setTextDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [displayWidth, setDisplayWidth] = useState(720);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  actionsRef.current = actions;

  const fitDisplayWidth = useCallback((imageWidth: number) => {
    const viewport = viewportRef.current;
    const maxWidth = viewport?.clientWidth ? Math.max(viewport.clientWidth - 16, 280) : 720;
    return Math.max(280, Math.min(maxWidth, imageWidth, 900));
  }, []);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageMeta) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== imageMeta.width || canvas.height !== imageMeta.height) {
      canvas.width = imageMeta.width;
      canvas.height = imageMeta.height;
    }
    renderScene(ctx, image, actionsRef.current, {
      pen: draftPen ?? undefined,
      arrow: draftArrow ?? undefined,
    }, { includeText: tool !== 'text' });
  }, [draftPen, draftArrow, imageMeta, tool]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    setImageMeta(null);
    setActions([]);
    setDraftPen(null);
    setDraftArrow(null);
    setTextDraft('');
    setTextPlacement(null);
    setEditingTextId(null);
    setSelectedTextId(null);
    setTextDrag(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTool('arrow');
    imageRef.current = null;

    if (!dataUrl?.trim()) {
      setLoadError('No photo data available.');
      setLoading(false);
      return;
    }

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setImageMeta({ width: image.naturalWidth, height: image.naturalHeight });
      setDisplayWidth(fitDisplayWidth(image.naturalWidth));
      setLoading(false);
    };
    image.onerror = () => {
      setLoadError('Could not load this photo for editing.');
      setLoading(false);
    };
    image.src = dataUrl;
  }, [open, dataUrl, fitDisplayWidth]);

  useEffect(() => {
    if (!open || loading || !imageMeta) return;
    repaint();
  }, [open, loading, imageMeta, actions, draftPen, draftArrow, tool, repaint]);

  useEffect(() => {
    if (!open || !imageMeta) return;
    const onResize = () => {
      setDisplayWidth(fitDisplayWidth(imageMeta.width));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, imageMeta, fitDisplayWidth]);

  useEffect(() => {
    if (!textPlacement) return;
    const timer = window.setTimeout(() => textInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [textPlacement, editingTextId]);

  const updateTextShape = (id: string, updater: (shape: TextShape) => TextShape) => {
    setActions((current) =>
      current.map((action) =>
        action.kind === 'text' && action.text.id === id
          ? { kind: 'text', text: updater(action.text) }
          : action,
      ),
    );
  };

  const beginEditText = (shape: TextShape) => {
    setEditingTextId(shape.id);
    setSelectedTextId(shape.id);
    setTextDraft(shape.text);
    setTextPlacement({ x: shape.x, y: shape.y });
    setColor(shape.color);
  };

  const clearTextEditing = () => {
    setTextDraft('');
    setTextPlacement(null);
    setEditingTextId(null);
  };

  const pushAction = (action: EditorAction) => {
    setActions((current) => [...current, action]);
  };

  const undo = () => {
    setActions((current) => current.slice(0, -1));
    setDraftPen(null);
    setDraftArrow(null);
    clearTextEditing();
    setSelectedTextId(null);
    setTextDrag(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || loading || tool === 'text') return;
    canvas.setPointerCapture(event.pointerId);

    if (tool === 'pan') {
      setPanDrag({ startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y });
      return;
    }

    const point = clientToCanvas(canvas, event.clientX, event.clientY);

    if (tool === 'pen') {
      setIsDrawing(true);
      setDraftPen({
        id: crypto.randomUUID(),
        color,
        width: Math.max(3, canvas.width / 280),
        points: [point],
      });
      return;
    }

    if (tool === 'arrow') {
      setIsDrawing(true);
      setDraftArrow({ from: point, to: point, color });
      return;
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'text' || loading || textDrag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = clientToCanvas(canvas, event.clientX, event.clientY);
    const existing = findTextAtPoint(actionsRef.current, point, canvas);
    if (existing) {
      beginEditText(existing);
      return;
    }
    setEditingTextId(null);
    setSelectedTextId(null);
    setTextDraft('');
    setTextPlacement(point);
  };

  const cancelText = () => {
    clearTextEditing();
    setSelectedTextId(null);
  };

  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    setActions((current) => current.filter((action) => action.kind !== 'text' || action.text.id !== selectedTextId));
    clearTextEditing();
    setSelectedTextId(null);
  };

  const handleTextOverlayPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    shape: TextShape,
  ) => {
    if (tool !== 'text') return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = clientToCanvas(canvas, event.clientX, event.clientY);
    setSelectedTextId(shape.id);
    setEditingTextId(null);
    setTextPlacement(null);
    setTextDraft('');
    setTextDrag({
      id: shape.id,
      offsetX: point.x - shape.x,
      offsetY: point.y - shape.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTextOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!textDrag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = clientToCanvas(canvas, event.clientX, event.clientY);
    updateTextShape(textDrag.id, (shape) => ({
      ...shape,
      x: point.x - textDrag.offsetX,
      y: point.y - textDrag.offsetY,
    }));
  };

  const finishTextDrag = () => {
    setTextDrag(null);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panDrag) {
      setPan({
        x: panDrag.originX + (event.clientX - panDrag.startX),
        y: panDrag.originY + (event.clientY - panDrag.startY),
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) return;
    const point = clientToCanvas(canvas, event.clientX, event.clientY);

    if (tool === 'pen' && draftPen) {
      setDraftPen({ ...draftPen, points: [...draftPen.points, point] });
      return;
    }

    if (tool === 'arrow' && draftArrow) {
      setDraftArrow({ ...draftArrow, to: point });
    }
  };

  const finishPointer = () => {
    if (panDrag) {
      setPanDrag(null);
      return;
    }

    if (tool === 'pen' && draftPen && draftPen.points.length > 1) {
      pushAction({ kind: 'pen', stroke: draftPen });
    }
    if (tool === 'arrow' && draftArrow) {
      const { from, to } = draftArrow;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      if (distance > 8) {
        pushAction({
          kind: 'arrow',
          arrow: { id: crypto.randomUUID(), color: draftArrow.color, from, to },
        });
      }
    }

    setIsDrawing(false);
    setDraftPen(null);
    setDraftArrow(null);
  };

  const saveText = () => {
    const trimmed = textDraft.trim();
    if (!trimmed || !textPlacement) return;
    const canvas = canvasRef.current;
    const fontSize = canvas ? Math.max(18, Math.round(canvas.width / 32)) : 22;
    if (editingTextId) {
      updateTextShape(editingTextId, (shape) => ({
        ...shape,
        text: trimmed,
        x: textPlacement.x,
        y: textPlacement.y,
        color,
        fontSize,
      }));
      setSelectedTextId(editingTextId);
    } else {
      const id = crypto.randomUUID();
      pushAction({
        kind: 'text',
        text: {
          id,
          color,
          x: textPlacement.x,
          y: textPlacement.y,
          text: trimmed,
          fontSize,
        },
      });
      setSelectedTextId(id);
    }
    clearTextEditing();
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    setZoom((current) => Math.min(4, Math.max(0.4, Number((current + delta).toFixed(2)))));
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderScene(ctx, image, actionsRef.current, undefined, { includeText: true });
    onSave(canvas.toDataURL('image/jpeg', 0.92));
  };

  const displayHeight = imageMeta
    ? (displayWidth / imageMeta.width) * imageMeta.height
    : 320;

  const textOverlayPosition =
    textPlacement && imageMeta
      ? canvasToDisplay(textPlacement, imageMeta, displayWidth, displayHeight)
      : null;

  const previewFontSize = imageMeta
    ? (Math.max(18, Math.round(imageMeta.width / 32)) / imageMeta.width) * displayWidth
    : 14;

  const labels = textActions(actions);
  const isTypingText = Boolean(textPlacement);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="full"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={actions.length === 0} onClick={undo}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Undo
            </Button>
            <Button type="button" size="sm" disabled={loading} onClick={handleSave}>
              <Save className="mr-1 h-4 w-4" />
              Save photo
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {(
              [
                { id: 'pan' as const, label: 'Pan', icon: Hand },
                { id: 'arrow' as const, label: 'Arrow', icon: ArrowUpRight },
                { id: 'pen' as const, label: 'Mark', icon: Pencil },
                { id: 'text' as const, label: 'Text', icon: Type },
              ] as const
            ).map(({ id, label: toolLabel, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={tool === id ? 'primary' : 'secondary'}
                onClick={() => {
                  if (id !== 'text' && textPlacement && textDraft.trim()) {
                    saveText();
                  } else {
                    clearTextEditing();
                  }
                  setTool(id);
                  setSelectedTextId(null);
                  setTextDrag(null);
                }}
              >
                <Icon className="mr-1 h-4 w-4" />
                {toolLabel}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
            {COLORS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                title={entry.label}
                className={cn(
                  'h-7 w-7 rounded-full border-2',
                  color === entry.value ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                )}
                style={{ backgroundColor: entry.value }}
                onClick={() => setColor(entry.value)}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border px-1 py-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[3.5rem] text-center text-xs text-text-muted">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="secondary" size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.2))}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset view
            </Button>
          </div>

          {tool === 'text' && selectedTextId && !isTypingText ? (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const shape = labels.find((label) => label.id === selectedTextId);
                  if (shape) beginEditText(shape);
                }}
              >
                Edit label
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={deleteSelectedText}>
                Delete label
              </Button>
            </div>
          ) : null}
        </div>

        <p className="text-xs text-text-muted">
          Text: click the photo to add a label, click a label to edit, or drag a label to move it.
        </p>

        <div
          ref={viewportRef}
          className="relative flex min-h-[320px] items-start justify-center overflow-auto rounded-lg border border-border bg-[#1a1a1a] p-2"
          style={{ maxHeight: '58vh' }}
          onWheel={handleWheel}
        >
          {loading ? (
            <div className="flex min-h-[280px] w-full items-center justify-center text-sm text-white/70">
              Loading photo…
            </div>
          ) : loadError ? (
            <div className="flex min-h-[280px] w-full items-center justify-center px-4 text-center text-sm text-danger">
              {loadError}
            </div>
          ) : imageMeta ? (
            <div
              className="relative shrink-0"
              style={{
                width: displayWidth,
                height: displayHeight,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'top center',
              }}
            >
              <canvas
                ref={canvasRef}
                width={imageMeta.width}
                height={imageMeta.height}
                className={cn(
                  'block h-auto w-full touch-none bg-black',
                  tool === 'pan'
                    ? 'cursor-grab active:cursor-grabbing'
                    : tool === 'text'
                      ? 'cursor-text'
                      : 'cursor-crosshair',
                )}
                style={{ width: displayWidth, height: displayHeight }}
                onClick={handleCanvasClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
              />
              {tool === 'text'
                ? labels
                    .filter((label) => label.id !== editingTextId)
                    .map((label) => {
                      const position = canvasToDisplay(
                        { x: label.x, y: label.y },
                        imageMeta,
                        displayWidth,
                        displayHeight,
                      );
                      const labelFontSize = (label.fontSize / imageMeta.width) * displayWidth;
                      const isSelected = selectedTextId === label.id;
                      return (
                        <div
                          key={label.id}
                          className={cn(
                            'absolute z-10 max-w-[min(320px,92%)] select-none rounded px-1 py-0.5',
                            isSelected ? 'ring-2 ring-primary/80' : 'ring-1 ring-white/30',
                            textDrag?.id === label.id ? 'cursor-grabbing' : 'cursor-move',
                          )}
                          style={{
                            left: position.x,
                            top: position.y,
                            color: label.color,
                            fontSize: labelFontSize,
                            fontWeight: 600,
                            lineHeight: 1.25,
                            WebkitTextStroke: '0.5px rgba(0,0,0,0.85)',
                            textShadow: '0 1px 2px rgba(0,0,0,0.85)',
                          }}
                          onPointerDown={(event) => handleTextOverlayPointerDown(event, label)}
                          onPointerMove={handleTextOverlayPointerMove}
                          onPointerUp={finishTextDrag}
                          onPointerCancel={finishTextDrag}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            beginEditText(label);
                          }}
                        >
                          {label.text}
                        </div>
                      );
                    })
                : null}
              {tool === 'text' && textOverlayPosition ? (
                <div
                  className="absolute z-20 min-w-[180px] max-w-[min(300px,92%)]"
                  style={{ left: textOverlayPosition.x, top: textOverlayPosition.y }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <textarea
                    ref={textInputRef}
                    lang="en-AU"
                    spellCheck
                    rows={3}
                    value={textDraft}
                    placeholder="Type label text…"
                    className="w-full resize-none rounded border border-primary/40 bg-black/80 px-2 py-1 text-sm font-semibold shadow-lg outline-none ring-2 ring-primary/40"
                    style={{
                      color,
                      fontSize: previewFontSize,
                      lineHeight: 1.3,
                      WebkitTextStroke: '0.5px rgba(0,0,0,0.85)',
                    }}
                    onChange={(event) => setTextDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        saveText();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelText();
                      }
                    }}
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button type="button" size="sm" disabled={!textDraft.trim()} onClick={saveText}>
                      Done
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={cancelText}>
                      Cancel
                    </Button>
                  </div>
                  <CommentWritingAssist variant="overlay" text={textDraft} onApplyText={setTextDraft} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
