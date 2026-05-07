"use client";

import { Check, Layers, Palette, Search, Type, ZoomIn } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store";
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  THEMES,
  type FontFamilyId,
  type FontSizeId,
  type ThemeMeta,
  type ThemeId,
} from "@/lib/themes";

export function AppearanceSettings() {
  const themeId = useAppStore((s) => s.themeId);
  const setThemeId = useAppStore((s) => s.setThemeId);
  const fontFamilyId = useAppStore((s) => s.fontFamilyId);
  const setFontFamilyId = useAppStore((s) => s.setFontFamilyId);
  const fontSizeId = useAppStore((s) => s.fontSizeId);
  const setFontSizeId = useAppStore((s) => s.setFontSizeId);
  const liteMode = useAppStore((s) => s.liteMode);
  const setLiteMode = useAppStore((s) => s.setLiteMode);

  const [query, setQuery] = useState("");

  const filteredThemes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return THEMES;
    return THEMES.filter((theme) => {
      const haystack = `${theme.name} ${theme.group} ${theme.description}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  const groupedThemes = useMemo(() => {
    return filteredThemes.reduce<Record<string, ThemeMeta[]>>((acc, theme) => {
      const list = acc[theme.group] ?? [];
      list.push(theme);
      acc[theme.group] = list;
      return acc;
    }, {});
  }, [filteredThemes]);

  const groupOrder = useMemo(() => {
    const preferred = ["Hardcore Black", "Neutrals", "Blue", "Purple", "Green", "Warm", "Classic"];
    const available = Object.keys(groupedThemes);
    const ordered = preferred.filter((group) => available.includes(group));
    const rest = available.filter((group) => !preferred.includes(group)).sort();
    return [...ordered, ...rest];
  }, [groupedThemes]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-(--border) bg-(--surface) p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-(--dim)" strokeWidth={1.7} />
          <h3 className="text-sm font-medium text-(--fg)">Interface Mode</h3>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-(--dim)">Navigation Scope</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLiteMode(true)}
              className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                liteMode
                  ? "border-(--accent) bg-(--accent) text-(--bg)"
                  : "border-(--border) text-(--fg) hover:bg-background"
              }`}
            >
              Lite (Agent Desktop)
            </button>
            <button
              type="button"
              onClick={() => setLiteMode(false)}
              className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                !liteMode
                  ? "border-(--accent) bg-(--accent) text-(--bg)"
                  : "border-(--border) text-(--fg) hover:bg-background"
              }`}
            >
              Full (vLLM Infra)
            </button>
          </div>
          <p className="text-[11px] text-(--dim)">
            {liteMode
              ? "Shows Agent + Settings only. Use when vLLM is org-managed."
              : "Shows all tabs including Status, Usage, Models, Server logs."}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-(--border) bg-(--surface) p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-(--dim)" strokeWidth={1.7} />
          <h3 className="text-sm font-medium text-(--fg)">Typography</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-(--dim)">Font Type</label>
            <div className="flex flex-wrap gap-2">
              {FONT_FAMILY_OPTIONS.map((option) => {
                const active = option.id === fontFamilyId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFontFamilyId(option.id as FontFamilyId)}
                    className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      active
                        ? "border-(--accent) bg-(--accent) text-(--bg)"
                        : "border-(--border) text-(--fg) hover:bg-background"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-(--dim)">Font Size</label>
            <div className="flex flex-wrap gap-2">
              {FONT_SIZE_OPTIONS.map((option) => {
                const active = option.id === fontSizeId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFontSizeId(option.id as FontSizeId)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      active
                        ? "border-(--accent) bg-(--accent) text-(--bg)"
                        : "border-(--border) text-(--fg) hover:bg-background"
                    }`}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-(--border) bg-(--surface) p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-(--dim)" strokeWidth={1.7} />
          <h3 className="text-sm font-medium text-(--fg)">Color Themes</h3>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-(--border) bg-background/80">
          <Search className="h-3.5 w-3.5 text-(--dim)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search themes"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-(--fg) placeholder:text-(--dim)"
          />
        </div>

        <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
          {filteredThemes.length === 0 ? (
            <div className="py-10 text-center text-sm text-(--dim)">No themes match your search.</div>
          ) : (
            groupOrder.map((group) => {
              const themes = groupedThemes[group] ?? [];
              if (themes.length === 0) return null;
              return (
                <div key={group} className="space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-(--dim)">{group}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {themes.map((theme) => {
                      const active = theme.id === themeId;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setThemeId(theme.id as ThemeId)}
                          className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                            active
                              ? "border-(--accent) bg-(--accent)/14"
                              : "border-(--border) hover:bg-background"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex items-center gap-1 pt-0.5">
                              {theme.swatches.map((color, index) => (
                                <span
                                  key={`${theme.id}-${index}`}
                                  className="w-3 h-3 rounded-full border border-white/15"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-(--fg) truncate">{theme.name}</span>
                                {active && <Check className="h-3.5 w-3.5 text-(--hl2) shrink-0" />}
                              </div>
                              <p className="mt-1 text-[11px] text-(--dim) line-clamp-2">{theme.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
