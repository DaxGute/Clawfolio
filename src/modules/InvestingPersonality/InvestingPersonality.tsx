import { useEffect, useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./InvestingPersonality.module.css";

type SliderValue = 0 | 1 | 2 | 3;

const labels: Record<
  "horizon" | "risk" | "frequency",
  [string, string, string, string]
> = {
  horizon: ["Short-Term", "Medium-Term", "Long-Term", "Generational"],
  risk: ["Conservative", "Balanced", "Aggressive", "Speculative"],
  frequency: ["Day Trader", "Swing Trader", "Position Trader", "Long-Term Holder"],
};

const philosophyEntries: { term: string; description: string }[] = [
  {
    term: "Value",
    description:
      "Seeks undervalued assets believed to be trading below their intrinsic worth.",
  },
  {
    term: "Growth",
    description: "Focuses on companies or sectors expected to expand rapidly over time.",
  },
  {
    term: "Momentum",
    description:
      "Favors assets demonstrating strong price trends and sustained market strength.",
  },
  {
    term: "Quality",
    description:
      "Prioritizes financially resilient businesses with strong fundamentals and competitive advantages.",
  },
  {
    term: "Income",
    description:
      "Targets investments that generate consistent cash flow through dividends, yield, or fixed income.",
  },
  {
    term: "Macro",
    description:
      "Builds positions around economic trends, interest rates, policy shifts, and global market conditions.",
  },
  {
    term: "Index",
    description:
      "Emphasizes diversified, passive exposure designed to track broader market performance.",
  },
];

const GLOSSARY_SCROLL = {
  tradingFrequency: "glossary-trading-frequency",
  timeHorizon: "glossary-time-horizon",
  riskAppetite: "glossary-risk-appetite",
  philosophy: "glossary-philosophy",
} as const;

const glossarySections: {
  title: string;
  scrollId: string;
  rows: { term: string; description: string }[];
}[] = [
  {
    title: "Trading Frequency",
    scrollId: GLOSSARY_SCROLL.tradingFrequency,
    rows: [
      {
        term: "Day Trader",
        description:
          "Executes trades within the same day, focusing on short-term price movements and market momentum.",
      },
      {
        term: "Swing Trader",
        description:
          "Holds positions for days to weeks to capture medium-term trends and market swings.",
      },
      {
        term: "Position Trader",
        description:
          "Takes longer-duration positions based on broader market trends, typically holding for weeks or months.",
      },
      {
        term: "Long-Term Holder",
        description:
          "Invests with minimal trading activity, prioritizing long-term growth and compounding over years.",
      },
    ],
  },
  {
    title: "Time Horizon",
    scrollId: GLOSSARY_SCROLL.timeHorizon,
    rows: [
      {
        term: "Short-Term",
        description:
          "Focused on returns over the near future, typically ranging from months to a few years.",
      },
      {
        term: "Medium-Term",
        description:
          "Balances growth and flexibility with investment goals spanning several years.",
      },
      {
        term: "Long-Term",
        description:
          "Built around sustained growth and compounding over long multi-year periods.",
      },
      {
        term: "Generational",
        description:
          "Designed for preserving and growing wealth across decades or future generations.",
      },
    ],
  },
  {
    title: "Risk Appetite",
    scrollId: GLOSSARY_SCROLL.riskAppetite,
    rows: [
      {
        term: "Conservative",
        description:
          "Prioritizes stability and downside protection, even if it limits potential returns.",
      },
      {
        term: "Balanced",
        description: "Seeks a middle ground between growth and risk through diversified exposure.",
      },
      {
        term: "Aggressive",
        description: "Accepts higher volatility in pursuit of stronger long-term returns.",
      },
      {
        term: "Speculative",
        description:
          "Targets outsized gains through high-risk opportunities with significant uncertainty and volatility.",
      },
    ],
  },
  {
    title: "Philosophy",
    scrollId: GLOSSARY_SCROLL.philosophy,
    rows: philosophyEntries,
  },
];

function HelpIconButton(props: {
  onClick: () => void;
  expanded: boolean;
  controlsId: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={styles.helpButton}
      onClick={props.onClick}
      aria-label={props.ariaLabel ?? "Open definitions glossary"}
      aria-expanded={props.expanded}
      aria-controls={props.controlsId}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M9.5 9.5a2.5 2.2 0 1 1 3.4 2 1.5 1.5 0 0 0-1.4 1.4V15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="17.5" r="1" fill="currentColor" />
      </svg>
    </button>
  );
}

function DefinitionsDialog(props: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  dialogId: string;
  scrollTargetId: string | null;
}) {
  useLayoutEffect(() => {
    if (!props.open || !props.scrollTargetId) return;
    const el = document.getElementById(props.scrollTargetId);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth", inline: "nearest" });
  }, [props.open, props.scrollTargetId]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return createPortal(
    <div
      className={styles.glossaryOverlay}
      onClick={props.onClose}
      role="presentation"
    >
      <div
        id={props.dialogId}
        className={styles.glossaryDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.glossaryAccent} aria-hidden />
        <button
          type="button"
          className={styles.glossaryClose}
          onClick={props.onClose}
          aria-label="Close definitions"
        >
          <span aria-hidden>×</span>
        </button>

        <h3 id={props.titleId} className={styles.glossaryTitle}>
          Definitions
        </h3>
        <p className={styles.glossaryLead}>
          How each slider option maps to the investor personality
        </p>

        <div className={styles.glossaryTableWrap}>
          <table className={styles.glossaryTable}>
            {glossarySections.map((section) => (
              <tbody key={section.title} id={section.scrollId} className={styles.glossaryTbody}>
                <tr className={styles.glossarySectionRow}>
                  <th colSpan={2} scope="colgroup" className={styles.glossarySectionHead}>
                    {section.title}
                  </th>
                </tr>
                {section.rows.map((row) => (
                  <tr key={row.term} className={styles.glossaryDataRow}>
                    <td className={styles.glossaryTerm}>{row.term}</td>
                    <td className={styles.glossaryDesc}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SectorsGuideDialog(props: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  dialogId: string;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return createPortal(
    <div
      className={styles.glossaryOverlay}
      onClick={props.onClose}
      role="presentation"
    >
      <div
        id={props.dialogId}
        className={styles.glossaryDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.glossaryAccent} aria-hidden />
        <button
          type="button"
          className={styles.glossaryClose}
          onClick={props.onClose}
          aria-label="Close sector guide"
        >
          <span aria-hidden>×</span>
        </button>

        <h3 id={props.titleId} className={styles.glossaryTitle}>
          Sector targeting
        </h3>
        <p className={styles.glossaryLead}>
          How to use these fields and how they steer the portfolio in Clawfolio.
        </p>

        <div className={styles.guideStack}>
          <div>
            <h4 className={styles.guideSubhead}>How to use</h4>
            <p className={styles.guideP}>
              Type a sector name in each field, then press{" "}
              <kbd className={styles.guideKbd}>Enter</kbd> to add it as a tag. Click the × on a
              tag to remove it. When the input is empty,{" "}
              <kbd className={styles.guideKbd}>Backspace</kbd> removes the last tag you added.
            </p>
          </div>
          <div>
            <h4 className={styles.guideSubhead}>Sector Focus</h4>
            <p className={styles.guideP}>
              Tags here skew the portfolio <span className={styles.guideEm}>toward</span> those
              sectors: suggestions and allocations can overweight or prioritize names in the
              industries you list, so the mix tilts in their direction versus a neutral baseline.
            </p>
          </div>
          <div>
            <h4 className={styles.guideSubhead}>Sector Blacklist</h4>
            <p className={styles.guideP}>
              Tags here skew the portfolio <span className={styles.guideEm}>away from</span> those
              sectors: ideas and weights can avoid or underweight those industries so exposure drifts
              down relative to the rest of the market.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SectorTagsField(props: {
  id: string;
  tags: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  placeholder: string;
}) {
  const commitDraft = () => {
    const next = props.draft.trim();
    if (!next) return;
    props.onAddTag(next);
    props.onDraftChange("");
  };

  return (
    <div className={styles.tagField}>
      {props.tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => props.onRemoveTag(tag)}
            aria-label={`Remove ${tag}`}
          >
            <span aria-hidden>×</span>
          </button>
        </span>
      ))}
      <input
        id={props.id}
        className={styles.tagFieldInput}
        type="text"
        value={props.draft}
        placeholder={props.tags.length === 0 ? props.placeholder : ""}
        onChange={(e) => props.onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
            return;
          }
          if (e.key === "Backspace" && props.draft === "" && props.tags.length > 0) {
            props.onRemoveTag(props.tags[props.tags.length - 1]);
          }
        }}
      />
    </div>
  );
}

function SliderRow(props: {
  label: string;
  value: SliderValue;
  onChange: (v: SliderValue) => void;
  options: [string, string, string, string];
  glossaryScrollId: string;
  onOpenGlossary: (scrollId: string) => void;
  glossaryOpen: boolean;
  glossaryControlsId: string;
}) {
  const id = useId();

  const trackVars = {
    "--thumb": "18px",
  } as React.CSSProperties;

  return (
    <div className={styles.sliderBlock}>
      <div className={styles.sliderHead}>
        <span className={styles.sliderLabel}>{props.label}</span>
        <HelpIconButton
          onClick={() => props.onOpenGlossary(props.glossaryScrollId)}
          expanded={props.glossaryOpen}
          controlsId={props.glossaryControlsId}
        />
      </div>
      <div className={styles.trackWrap} style={trackVars}>
        <input
          id={id}
          className={styles.range}
          type="range"
          min={0}
          max={3}
          step={1}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value) as SliderValue)}
          aria-valuetext={props.options[props.value]}
        />
        <div className={styles.tickStrip} aria-hidden>
          {props.options.map((option) => (
            <span key={option} className={styles.tick} />
          ))}
        </div>
        <div className={styles.captionRow}>
          <div
            className={styles.thumbCaption}
            data-slot={props.value}
            aria-hidden
          >
            {props.options[props.value]}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvestingPersonality() {
  const [horizon, setHorizon] = useState<SliderValue>(1);
  const [risk, setRisk] = useState<SliderValue>(0);
  const [frequency, setFrequency] = useState<SliderValue>(2);
  const [philosophyOpen, setPhilosophyOpen] = useState(false);
  const [philosophy, setPhilosophy] = useState("Macro");
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryScrollTargetId, setGlossaryScrollTargetId] = useState<string | null>(null);
  const [sectorFocusTags, setSectorFocusTags] = useState<string[]>([]);
  const [sectorFocusDraft, setSectorFocusDraft] = useState("");
  const [sectorBlacklistTags, setSectorBlacklistTags] = useState<string[]>([]);
  const [sectorBlacklistDraft, setSectorBlacklistDraft] = useState("");
  const [sectorsGuideOpen, setSectorsGuideOpen] = useState(false);

  const titleId = useId();
  const dialogId = useId();
  const sectorsGuideTitleId = useId();
  const sectorsGuideDialogId = useId();
  const sectorFocusInputId = useId();
  const sectorBlacklistInputId = useId();

  const addFocusTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSectorFocusTags((prev) => {
      if (prev.some((x) => x.toLowerCase() === t.toLowerCase())) return prev;
      return [...prev, t];
    });
  };

  const addBlacklistTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSectorBlacklistTags((prev) => {
      if (prev.some((x) => x.toLowerCase() === t.toLowerCase())) return prev;
      return [...prev, t];
    });
  };

  const openGlossary = (scrollId: string) => {
    setSectorsGuideOpen(false);
    setGlossaryScrollTargetId(scrollId);
    setGlossaryOpen(true);
  };

  const closeGlossary = () => {
    setGlossaryOpen(false);
  };

  const openSectorsGuide = () => {
    setGlossaryOpen(false);
    setSectorsGuideOpen(true);
  };

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Investing Personality</h2>

      <SliderRow
        label="Time Horizon"
        value={horizon}
        onChange={setHorizon}
        options={labels.horizon}
        glossaryScrollId={GLOSSARY_SCROLL.timeHorizon}
        onOpenGlossary={openGlossary}
        glossaryOpen={glossaryOpen}
        glossaryControlsId={dialogId}
      />
      <SliderRow
        label="Risk Appetite"
        value={risk}
        onChange={setRisk}
        options={labels.risk}
        glossaryScrollId={GLOSSARY_SCROLL.riskAppetite}
        onOpenGlossary={openGlossary}
        glossaryOpen={glossaryOpen}
        glossaryControlsId={dialogId}
      />
      <SliderRow
        label="Trading Frequency"
        value={frequency}
        onChange={setFrequency}
        options={labels.frequency}
        glossaryScrollId={GLOSSARY_SCROLL.tradingFrequency}
        onOpenGlossary={openGlossary}
        glossaryOpen={glossaryOpen}
        glossaryControlsId={dialogId}
      />

      <DefinitionsDialog
        open={glossaryOpen}
        onClose={closeGlossary}
        titleId={titleId}
        dialogId={dialogId}
        scrollTargetId={glossaryScrollTargetId}
      />

      <SectorsGuideDialog
        open={sectorsGuideOpen}
        onClose={() => setSectorsGuideOpen(false)}
        titleId={sectorsGuideTitleId}
        dialogId={sectorsGuideDialogId}
      />

      <div className={styles.fieldBlock}>
        <div className={styles.sliderHead}>
          <span className={styles.sliderLabel}>Philosophy</span>
          <HelpIconButton
            onClick={() => openGlossary(GLOSSARY_SCROLL.philosophy)}
            expanded={glossaryOpen}
            controlsId={dialogId}
          />
        </div>
        <div className={styles.dropdownWrap}>
          <button
            type="button"
            className={styles.pillButton}
            aria-expanded={philosophyOpen}
            onClick={() => setPhilosophyOpen((o) => !o)}
          >
            {philosophy}
            <span className={styles.chev} aria-hidden>
              ›
            </span>
          </button>
          {philosophyOpen && (
            <ul className={styles.menu} role="listbox">
              {philosophyEntries.map(({ term: opt }) => (
                <li key={opt}>
                  <button
                    type="button"
                    className={
                      opt === philosophy
                        ? `${styles.menuItem} ${styles.menuItemSelected}`
                        : styles.menuItem
                    }
                    onClick={() => {
                      setPhilosophy(opt);
                      setPhilosophyOpen(false);
                    }}
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.fieldBlock}>
        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor={sectorFocusInputId}>
            Sector Focus
          </label>
          <HelpIconButton
            onClick={openSectorsGuide}
            expanded={sectorsGuideOpen}
            controlsId={sectorsGuideDialogId}
            ariaLabel="Open sector targeting guide"
          />
        </div>
        <SectorTagsField
          id={sectorFocusInputId}
          tags={sectorFocusTags}
          draft={sectorFocusDraft}
          onDraftChange={setSectorFocusDraft}
          onAddTag={addFocusTag}
          onRemoveTag={(tag) =>
            setSectorFocusTags((prev) => prev.filter((x) => x !== tag))
          }
          placeholder="e.g. Technology"
        />
      </div>

      <div className={styles.fieldBlock}>
        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor={sectorBlacklistInputId}>
            Sector Blacklist
          </label>
          <HelpIconButton
            onClick={openSectorsGuide}
            expanded={sectorsGuideOpen}
            controlsId={sectorsGuideDialogId}
            ariaLabel="Open sector targeting guide"
          />
        </div>
        <SectorTagsField
          id={sectorBlacklistInputId}
          tags={sectorBlacklistTags}
          draft={sectorBlacklistDraft}
          onDraftChange={setSectorBlacklistDraft}
          onAddTag={addBlacklistTag}
          onRemoveTag={(tag) =>
            setSectorBlacklistTags((prev) => prev.filter((x) => x !== tag))
          }
          placeholder="e.g. Energy"
        />
      </div>
    </div>
  );
}
