import { useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface CounterProps {
  initialValue?: number;
}

export default function Counter({ initialValue = 0 }: CounterProps) {
  const [count, setCount] = useState(initialValue);
  const buttonClasses =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-ink transition-colors hover:border-neutral-500 hover:bg-neutral-100 motion-reduce:transition-none';

  return (
    <section aria-labelledby="counter-heading" className="w-full max-w-sm">
      <h2 id="counter-heading" className="mb-5 text-lg font-semibold">
        Contador
      </h2>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className={buttonClasses}
          aria-label="Disminuir contador"
          title="Disminuir contador"
          onClick={() => setCount((current) => current - 1)}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <output
          aria-label="Valor del contador"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 flex-1 overflow-auto text-center text-3xl font-semibold tabular-nums"
        >
          {count}
        </output>
        <button
          type="button"
          className={buttonClasses}
          aria-label="Aumentar contador"
          title="Aumentar contador"
          onClick={() => setCount((current) => current + 1)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={buttonClasses}
          aria-label="Restablecer contador"
          title="Restablecer contador"
          onClick={() => setCount(initialValue)}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
