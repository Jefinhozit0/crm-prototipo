import { useEffect, useState } from "react";

/** Valor "atrasado": só atualiza depois de `ms` sem mudanças (busca enquanto digita). */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
