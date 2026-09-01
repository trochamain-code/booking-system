"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { getCountryCallingCode, type Country } from "react-phone-number-input";

/**
 * Selector de país con buscador para react-phone-number-input.
 *
 * Sustituye al <select> nativo de la librería (245 opciones sin filtro, imposible
 * de recorrer en móvil) por un botón con la bandera que abre un panel con un
 * campo de búsqueda. Se puede buscar por nombre del país ("españa", sin tildes)
 * o por prefijo ("+34", "34"): es lo que la gente conoce cuando no sabe cómo se
 * llama el país en español.
 *
 * El panel va con position: fixed calculada desde el botón porque el widget vive
 * dentro de tarjetas con overflow-hidden (embed) que recortarían un absolute.
 */

type Option = { value?: Country; label: string; divider?: boolean };

type IconProps = { country?: Country; label: string; "aria-hidden"?: boolean };

export function PhoneCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  iconComponent: Icon,
  name,
  "aria-label": ariaLabel,
  onFocus,
  onBlur,
}: {
  value?: Country;
  onChange: (country?: Country) => void;
  options: Option[];
  disabled?: boolean;
  readOnly?: boolean;
  iconComponent: ComponentType<IconProps>;
  name?: string;
  "aria-label"?: string;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<CSSProperties>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // Se precalculan nombre normalizado y prefijo una sola vez: el filtro corre en
  // cada pulsación y la lista tiene ~245 entradas.
  const countries = useMemo(
    () =>
      options
        .filter((o): o is Option & { value: Country } => Boolean(o.value) && !o.divider)
        .map((o) => ({
          code: o.value,
          label: o.label,
          search: normalize(o.label),
          callingCode: getCountryCallingCode(o.value),
        })),
    [options],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return countries;
    const digits = q.replace(/\D/g, "");
    const byPrefix = digits.length > 0 && /^\+?\d[\d\s]*$/.test(q);
    if (!byPrefix) {
      return countries.filter((c) => c.search.includes(q) || c.code.toLowerCase() === q);
    }
    // Buscando por prefijo, primero los países con ese prefijo exacto y, entre
    // ellos, el principal ("+44" → Reino Unido antes que Guernsey); después los
    // que solo empiezan por él ("+3" → +30, +31…), en orden alfabético.
    return countries
      .filter((c) => c.callingCode.startsWith(digits))
      .sort((a, b) => rank(a, digits) - rank(b, digits));
  }, [countries, query]);

  const selected = countries.find((c) => c.code === value);

  function openPanel() {
    if (disabled || readOnly) return;
    setQuery("");
    setActive(Math.max(0, countries.findIndex((c) => c.code === value)));
    setOpen(true);
  }

  function close(refocus = false) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function pick(code: Country) {
    onChange(code);
    // La librería mueve el foco al input del número al cambiar de país
    // (focusInputOnCountrySelection), así que aquí solo se cierra.
    setOpen(false);
  }

  // Posición del panel bajo el botón (o encima si no cabe), recalculada al
  // hacer scroll o cambiar el tamaño de la ventana mientras está abierto.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const height = Math.min(320, Math.max(spaceBelow, rect.top) - 12);
      const above = spaceBelow < 220 && rect.top > spaceBelow;
      setPos({
        left,
        width,
        maxHeight: height,
        ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // La opción activa (teclado) se mantiene a la vista dentro de la lista.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(filtered.length - 1);
        break;
      case "Enter": {
        e.preventDefault();
        const c = filtered[active];
        if (c) pick(c.code);
        break;
      }
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        close();
        break;
    }
  }

  const activeId = filtered[active] ? `${listId}-${filtered[active].code}` : undefined;

  return (
    <div className="PhoneInputCountry">
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        ref={buttonRef}
        type="button"
        className="phone-country-btn"
        aria-label={selected ? `País: ${selected.label}` : ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || readOnly}
        onClick={() => (open ? close() : openPanel())}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <Icon aria-hidden country={value} label={selected?.label ?? ""} />
        <span className="PhoneInputCountrySelectArrow" />
      </button>

      {open && (
        <div ref={panelRef} className="phone-country-panel" style={pos}>
          <div className="phone-country-search">
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar país o prefijo (+34)"
              aria-label="Buscar país o prefijo"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={activeId}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="phone-country-list">
            {filtered.length === 0 && <li className="phone-country-empty">Sin resultados</li>}
            {filtered.map((c, i) => (
              <li
                key={c.code}
                id={`${listId}-${c.code}`}
                role="option"
                aria-selected={c.code === value}
                data-index={i}
                data-active={i === active || undefined}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => pick(c.code)}
              >
                <Icon aria-hidden country={c.code} label={c.label} />
                <span className="phone-country-name">{c.label}</span>
                <span className="phone-country-code">+{c.callingCode}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * País principal de los prefijos compartidos entre varios. La librería no expone
 * ese dato, y sin él "+1" empezaría por Anguila en vez de Estados Unidos.
 */
const MAIN_COUNTRY: Record<string, Country> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "212": "MA",
  "262": "RE",
  "358": "FI",
  "590": "GP",
  "596": "MQ",
  "599": "CW",
};

function rank(c: { code: Country; callingCode: string }, digits: string) {
  if (c.callingCode !== digits) return 2;
  return MAIN_COUNTRY[digits] === c.code ? 0 : 1;
}

/** Minúsculas y sin diacríticos, para que "espana" encuentre "España". */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
