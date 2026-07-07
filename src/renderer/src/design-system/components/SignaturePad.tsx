import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/cn';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataUrl: () => string;
}

interface SignaturePadProps {
  className?: string;
  onChange?: (isEmpty: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ className, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const empty = useRef(true);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        empty.current = true;
        onChange?.(true);
      },
      isEmpty: () => empty.current,
      toDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? '',
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#1a1a1a';
        }
      };

      resize();
      window.addEventListener('resize', resize);

      const getPoint = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
          const touch = e.touches[0];
          return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };

      const start = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        drawing.current = true;
        const ctx = canvas.getContext('2d');
        const point = getPoint(e);
        ctx?.beginPath();
        ctx?.moveTo(point.x, point.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!drawing.current) return;
        e.preventDefault();
        const ctx = canvas.getContext('2d');
        const point = getPoint(e);
        ctx?.lineTo(point.x, point.y);
        ctx?.stroke();
        if (empty.current) {
          empty.current = false;
          onChange?.(false);
        }
      };

      const stop = () => {
        drawing.current = false;
      };

      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stop);
      canvas.addEventListener('mouseleave', stop);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      canvas.addEventListener('touchend', stop);

      return () => {
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('mousedown', start);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stop);
        canvas.removeEventListener('mouseleave', stop);
        canvas.removeEventListener('touchstart', start);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stop);
      };
    }, [onChange]);

    return (
      <canvas
        ref={canvasRef}
        className={cn('h-40 w-full rounded-sm border border-border bg-white touch-none', className)}
        aria-label="Signature pad"
      />
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
