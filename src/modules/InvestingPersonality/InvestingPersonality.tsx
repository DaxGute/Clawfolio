import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CLAWFOLIO_PROFILE_DRAFT_KEY,
  fetchInvestorProfile,
  saveInvestorProfile,
} from "../../api/clawfolioClient";
import type { ClawfolioInvestorProfile } from "../../types/clawfolio";
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

function indexForOption<T extends readonly string[]>(options: T, value: string): SliderValue {
  const i = options.findIndex((option) => option === value);
  return (i >= 0 ? i : 0) as SliderValue;
}

const philosophyEntries: { term: string; description: string }[] = [
  {
    term: "Value",
    description:
      "Seeks undervalued assets believed to be below intrinsic worth, so Clawfolio should reward margin of safety and be skeptical of expensive momentum.",
  },
  {
    term: "Growth",
    description: "Focuses on companies or sectors expected to expand rapidly, so Clawfolio should tolerate richer valuations when growth evidence is strong.",
  },
  {
    term: "Momentum",
    description:
      "Favors strong price trends and market strength, so Clawfolio should weigh recent relative performance and catalyst follow-through more heavily.",
  },
  {
    term: "Quality",
    description:
      "Prioritizes resilient businesses with strong fundamentals, so Clawfolio should prefer durable earnings, balance sheet strength, and defensible advantages.",
  },
  {
    term: "Income",
    description:
      "Targets consistent cash flow, so Clawfolio should care more about yield durability, payout risk, and downside protection.",
  },
  {
    term: "Macro",
    description:
      "Builds around economic trends, rates, policy, and global conditions, so Clawfolio should connect company suggestions to broader market regimes.",
  },
  {
    term: "Index",
    description:
      "Emphasizes diversified passive exposure, so Clawfolio should be more skeptical of concentrated single-name orders unless evidence is unusually strong.",
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
          "Executes trades within the same day, so Clawfolio should favor tighter entries, smaller notional sizing, and catalysts that matter immediately.",
      },
      {
        term: "Swing Trader",
        description:
          "Holds positions for days to weeks, so Clawfolio should emphasize near-term trend strength, catalysts, and exit discipline.",
      },
      {
        term: "Position Trader",
        description:
          "Takes longer-duration positions over weeks or months, so Clawfolio should weigh broader trend quality and avoid overreacting to daily noise.",
      },
      {
        term: "Long-Term Holder",
        description:
          "Invests with minimal trading activity, so Clawfolio should require stronger evidence before selling and size buys around durable theses.",
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
          "Focused on near-future returns, so stale momentum, drawdowns, or missing catalysts should weigh more heavily.",
      },
      {
        term: "Medium-Term",
        description:
          "Balances growth and flexibility over several years, keeping Clawfolio open to both tactical buys and risk-driven sells.",
      },
      {
        term: "Long-Term",
        description:
          "Built around multi-year compounding, so Clawfolio should tolerate more volatility when the longer thesis still looks intact.",
      },
      {
        term: "Generational",
        description:
          "Designed for decades-long compounding, so Clawfolio should be reluctant to sell quality assets without a major thesis break.",
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
          "Prioritizes stability and downside protection, causing Clawfolio to sell earlier on losses or concentration and size buys smaller.",
      },
      {
        term: "Balanced",
        description: "Seeks a middle ground between growth and risk through diversified exposure.",
      },
      {
        term: "Aggressive",
        description: "Accepts higher volatility for stronger returns, allowing wider drawdown tolerance and larger buy sizing.",
      },
      {
        term: "Speculative",
        description:
          "Targets outsized gains with high uncertainty, so Clawfolio may tolerate sharp volatility but should flag thesis and sizing risk clearly.",
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

const TAG_ENTER_MS = 220;
const TAG_EXIT_MS = 180;

function SectorTagsField(props: {
  id: string;
  tags: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  placeholder: string;
}) {
  const prevTagsRef = useRef(props.tags);
  const skipEnterRef = useRef(true);
  const [enteringTags, setEnteringTags] = useState<Set<string>>(() => new Set());
  const [exitingTags, setExitingTags] = useState<Set<string>>(() => new Set());
  const exitTimersRef = useRef<Map<string, number>>(new Map());

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const prev = prevTagsRef.current;
    const added = props.tags.filter((tag) => !prev.includes(tag));
    prevTagsRef.current = props.tags;

    if (skipEnterRef.current || added.length === 0 || prefersReducedMotion) {
      skipEnterRef.current = false;
      return;
    }

    setEnteringTags((current) => {
      const next = new Set(current);
      for (const tag of added) next.add(tag);
      return next;
    });

    const timer = window.setTimeout(() => {
      setEnteringTags((current) => {
        const next = new Set(current);
        for (const tag of added) next.delete(tag);
        return next;
      });
    }, TAG_ENTER_MS);

    return () => window.clearTimeout(timer);
  }, [props.tags, prefersReducedMotion]);

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const tagsToRender = (() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const tag of props.tags) {
      if (seen.has(tag)) continue;
      ordered.push(tag);
      seen.add(tag);
    }
    for (const tag of exitingTags) {
      if (seen.has(tag)) continue;
      ordered.push(tag);
      seen.add(tag);
    }
    return ordered;
  })();

  const finishExit = (tag: string) => {
    setExitingTags((current) => {
      if (!current.has(tag)) return current;
      const next = new Set(current);
      next.delete(tag);
      return next;
    });
    props.onRemoveTag(tag);
  };

  const requestRemove = (tag: string) => {
    if (exitingTags.has(tag)) return;
    if (prefersReducedMotion) {
      props.onRemoveTag(tag);
      return;
    }
    setExitingTags((current) => new Set(current).add(tag));
    const timer = window.setTimeout(() => {
      exitTimersRef.current.delete(tag);
      finishExit(tag);
    }, TAG_EXIT_MS);
    exitTimersRef.current.set(tag, timer);
  };

  const tagClassName = (tag: string) => {
    if (exitingTags.has(tag)) return `${styles.tag} ${styles.tagExiting}`;
    if (enteringTags.has(tag)) return `${styles.tag} ${styles.tagEntering}`;
    return styles.tag;
  };

  const commitDraft = () => {
    const next = props.draft.trim();
    if (!next) return;
    props.onAddTag(next);
    props.onDraftChange("");
  };

  return (
    <div className={styles.tagField}>
      {tagsToRender.map((tag) => (
        <span key={tag} className={tagClassName(tag)}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => requestRemove(tag)}
            aria-label={`Remove ${tag}`}
            disabled={exitingTags.has(tag)}
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
            const last = props.tags[props.tags.length - 1];
            if (last) requestRemove(last);
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
  const [dragging, setDragging] = useState(false);

  const trackVars = {
    "--thumb": "18px",
    "--slider-pos": props.value,
  } as React.CSSProperties;

  const setValueFromInput = (raw: string) => {
    props.onChange(Number(raw) as SliderValue);
  };

  const endDrag = () => setDragging(false);

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
      <div
        className={styles.trackWrap}
        style={trackVars}
        data-dragging={dragging ? "true" : "false"}
      >
        <div className={styles.trackLane}>
          <div className={styles.trackRail} aria-hidden />
          <div className={styles.trackFill} aria-hidden />
          <input
            id={id}
            className={styles.range}
            type="range"
            min={0}
            max={3}
            step={1}
            value={props.value}
            onPointerDown={() => setDragging(true)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onBlur={endDrag}
            onInput={(e) => setValueFromInput(e.currentTarget.value)}
            onChange={(e) => setValueFromInput(e.currentTarget.value)}
            aria-valuetext={props.options[props.value]}
          />
        </div>
        <div className={styles.tickStrip} aria-hidden>
          {props.options.map((option, index) => (
            <span
              key={option}
              className={
                index <= props.value
                  ? `${styles.tick} ${styles.tickFilled}`
                  : styles.tick
              }
              data-active={index === props.value ? "true" : "false"}
            />
          ))}
        </div>
        <div className={styles.captionRow}>
          <div
            className={styles.thumbCaption}
            data-slot={props.value}
            data-dragging={dragging ? "true" : "false"}
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
  const [philosophyMenuShown, setPhilosophyMenuShown] = useState(false);
  const [philosophyMenuClosing, setPhilosophyMenuClosing] = useState(false);
  const [philosophy, setPhilosophy] = useState("Macro");
  const philosophyMenuTimer = useRef<number | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryScrollTargetId, setGlossaryScrollTargetId] = useState<string | null>(null);
  const [sectorFocusTags, setSectorFocusTags] = useState<string[]>([]);
  const [sectorFocusDraft, setSectorFocusDraft] = useState("");
  const [sectorBlacklistTags, setSectorBlacklistTags] = useState<string[]>([]);
  const [sectorBlacklistDraft, setSectorBlacklistDraft] = useState("");
  const [sectorsGuideOpen, setSectorsGuideOpen] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileStatus, setProfileStatus] = useState("Loading profile...");

  const titleId = useId();
  const dialogId = useId();
  const sectorsGuideTitleId = useId();
  const sectorsGuideDialogId = useId();
  const sectorFocusInputId = useId();
  const sectorBlacklistInputId = useId();
  const skipNextProfileSave = useRef(true);

  const profile: ClawfolioInvestorProfile = {
    timeHorizon: labels.horizon[horizon] as ClawfolioInvestorProfile["timeHorizon"],
    riskAppetite: labels.risk[risk] as ClawfolioInvestorProfile["riskAppetite"],
    tradingFrequency: labels.frequency[frequency] as ClawfolioInvestorProfile["tradingFrequency"],
    philosophy: philosophy as ClawfolioInvestorProfile["philosophy"],
    sectorFocus: sectorFocusTags,
    sectorBlacklist: sectorBlacklistTags,
  };

  useEffect(() => {
    let cancelled = false;
    void fetchInvestorProfile()
      .then((next) => {
        if (cancelled) return;
        setHorizon(indexForOption(labels.horizon, next.timeHorizon));
        setRisk(indexForOption(labels.risk, next.riskAppetite));
        setFrequency(indexForOption(labels.frequency, next.tradingFrequency));
        setPhilosophy(next.philosophy);
        setSectorFocusTags(next.sectorFocus);
        setSectorBlacklistTags(next.sectorBlacklist);
        window.localStorage.setItem(CLAWFOLIO_PROFILE_DRAFT_KEY, JSON.stringify(next));
        skipNextProfileSave.current = true;
        setProfileLoaded(true);
        setProfileStatus("Profile drives evaluation");
      })
      .catch((err) => {
        if (cancelled) return;
        setProfileLoaded(true);
        setProfileStatus(err instanceof Error ? err.message : "Could not load profile");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    window.localStorage.setItem(CLAWFOLIO_PROFILE_DRAFT_KEY, JSON.stringify(profile));
    if (skipNextProfileSave.current) {
      skipNextProfileSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setProfileStatus("Saving profile...");
      void saveInvestorProfile(profile)
        .then(() => setProfileStatus("Profile drives next run"))
        .catch((err) => {
          setProfileStatus(err instanceof Error ? err.message : "Could not save profile");
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    profileLoaded,
    profile.timeHorizon,
    profile.riskAppetite,
    profile.tradingFrequency,
    profile.philosophy,
    profile.sectorFocus.join("|"),
    profile.sectorBlacklist.join("|"),
  ]);

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

  const openPhilosophyMenu = () => {
    if (philosophyMenuTimer.current) {
      clearTimeout(philosophyMenuTimer.current);
      philosophyMenuTimer.current = null;
    }
    setPhilosophyMenuClosing(false);
    setPhilosophyMenuShown(true);
    setPhilosophyOpen(true);
  };

  const closePhilosophyMenu = () => {
    if (!philosophyMenuShown) return;
    setPhilosophyOpen(false);
    setPhilosophyMenuClosing(true);
    philosophyMenuTimer.current = window.setTimeout(() => {
      setPhilosophyMenuShown(false);
      setPhilosophyMenuClosing(false);
      philosophyMenuTimer.current = null;
    }, 180);
  };

  const togglePhilosophyMenu = () => {
    if (philosophyOpen) closePhilosophyMenu();
    else openPhilosophyMenu();
  };

  useEffect(() => {
    return () => {
      if (philosophyMenuTimer.current) clearTimeout(philosophyMenuTimer.current);
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Investing Personality</h2>
        <p className={styles.profileStatus}>{profileStatus}</p>
      </div>

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
            onClick={togglePhilosophyMenu}
          >
            {philosophy}
            <span className={styles.chev} aria-hidden>
              ›
            </span>
          </button>
          {philosophyMenuShown && (
            <ul
              className={
                philosophyMenuClosing
                  ? `${styles.menu} ${styles.menuClosing}`
                  : styles.menu
              }
              role="listbox"
            >
              {philosophyEntries.map(({ term: opt }, index) => (
                <li
                  key={opt}
                  className={styles.menuRow}
                  style={{ "--menu-i": index } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className={
                      opt === philosophy
                        ? `${styles.menuItem} ${styles.menuItemSelected}`
                        : styles.menuItem
                    }
                    onClick={() => {
                      setPhilosophy(opt);
                      closePhilosophyMenu();
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
