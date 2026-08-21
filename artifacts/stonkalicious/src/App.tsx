import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  ExternalLink,
  Flame,
  LockKeyhole,
  Menu,
  MousePointer2,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

type StageKey = 'newb' | 'liquidated' | 'back' | 'wrecked' | 'hardened' | 'profitable' | 'elite' | 'plumber';

type Stage = {
  key: StageKey;
  number: string;
  name: string;
  threshold: string;
  description: string;
  trait: string;
  color: string;
  image: string;
};

type Warrior = {
  rank: number;
  name: string;
  wallet: string;
  stage: StageKey;
  strength: number;
  growth: number;
  bag: string;
};

const stages: Stage[] = [
  ['newb', 'Newb', '0–12 strength', 'Everyone starts here. The orb is warm, the bag is small, and the first trade is still ahead.', 'open face / soft purple energy', '#7666c9', 'newb'],
  ['liquidated', 'Liquidated', '13–24 strength', 'The market collected its tax. Not dead — just dramatically underfunded.', 'burned armor / emergency glow', '#8d4654', 'liquidated'],
  ['back', 'Back', '25–36 strength', 'The comeback arc begins. A pulse returns to the orb and the warrior remembers the plan.', 'patched kit / comeback spark', '#bd7653', 'back'],
  ['wrecked', 'Wrecked', '37–48 strength', 'Volatility leaves a mark. The warrior is bruised, watchful, and somehow still holding the orb.', 'scarred steel / volatile fire', '#a75a48', 'wrecked'],
  ['hardened', 'Hardened', '49–60 strength', 'The portfolio has taken hits and kept going. Practical steel replaces the soft edges.', 'battle helmet / real fire', '#df7e3c', 'hardened'],
  ['profitable', 'Profitable', '61–72 strength', 'The numbers finally talk back. A positive ROI sharpens every edge.', 'war paint / profit glow', '#d99a48', 'profitable'],
  ['elite', 'Elite', '73–88 strength', 'A battle-worn status symbol. Bright flames, a hard gaze, and nothing left to prove.', 'worn armor / bright aura', '#f5bf58', 'elite'],
  ['plumber', 'Plumber', '89+ strength', 'The final form. Deep in the pipes of the market, this warrior fixes leaks and keeps building.', 'mythic kit / maxed-out aura', '#e8d8ac', 'plumber'],
].map(([key, name, threshold, description, trait, color, image], index) => ({
  key: key as StageKey,
  number: String(index + 1).padStart(2, '0'),
  name,
  threshold,
  description,
  trait,
  color,
  image: `/warriors/${image}.png`,
}));

const warriors: Warrior[] = [
  { rank: 1, name: 'orbital_ronin', wallet: '0x7F…91A2', stage: 'plumber', strength: 94, growth: 218.4, bag: '$482,190' },
  { rank: 2, name: 'marauder.eth', wallet: '0xD2…4F10', stage: 'elite', strength: 88, growth: 167.9, bag: '$301,842' },
  { rank: 3, name: 'cold_storage', wallet: '0xA8…BC33', stage: 'hardened', strength: 73, growth: 112.6, bag: '$188,460' },
  { rank: 4, name: 'redline_rider', wallet: '0x3C…008E', stage: 'hardened', strength: 68, growth: 92.3, bag: '$124,707' },
  { rank: 5, name: 'smallcap_samurai', wallet: '0x11…E2A9', stage: 'wrecked', strength: 46, growth: 71.8, bag: '$76,340' },
  { rank: 6, name: 'index_apprentice', wallet: '0xBE…771C', stage: 'back', strength: 38, growth: 48.7, bag: '$44,920' },
];

function setMeta(name: string, content: string, property?: string) {
  const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    if (property) element.setAttribute('property', property);
    else element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function WarriorIllustration({ stage }: { stage: StageKey }) {
  const artwork = stages.find((item) => item.key === stage)?.image ?? stages[0].image;
  return (
    <div className={`warrior-art warrior-float level-${stage}`} aria-label={`${stage} warrior visual`} data-testid={`illustration-warrior-${stage}`}>
      <img src={artwork} alt={`${stage} Stonkalicious warrior`} />
      <div className="artwork-glow" />
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-mark">
      <div className="relative grid h-10 w-10 place-items-center border-2 border-[#202534] bg-[#f5bf58]">
        <span className="h-4 w-4 rounded-full border-2 border-[#202534] bg-[#ec642f]" />
        <span className="absolute -right-1 -top-1 h-2 w-2 bg-[#ec642f]" />
      </div>
      <div>
        <div className="display-face text-[18px] font-extrabold leading-none tracking-[-.08em]">stonkalicious</div>
        <div className="mono-face mt-1 text-[9px] text-[#6e6b72]">on-chain status</div>
      </div>
    </div>
  );
}

function App() {
  const [activeStage, setActiveStage] = useState<StageKey>('plumber');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | StageKey>('all');
  const [sortMode, setSortMode] = useState<'strength' | 'growth'>('strength');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const selectedStage = stages.find((stage) => stage.key === activeStage) ?? stages[7];

  useEffect(() => {
    document.title = 'Stonkalicious — Your bag grows your warrior';
    setMeta('description', 'A dynamic NFT on Robinhood Chain. Your bag grows your warrior from naive to elite.');
    setMeta('', 'Stonkalicious — Your bag grows your warrior', 'og:title');
    setMeta('', 'A dynamic NFT status symbol powered by your allowlisted on-chain portfolio.', 'og:description');
    setMeta('', 'website', 'og:type');
    setMeta('', window.location.href, 'og:url');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', 'Stonkalicious — Your bag grows your warrior');
    setMeta('twitter:description', 'A dynamic NFT status symbol powered by your bag.');
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleWarriors = useMemo(() => {
    const filtered = leaderboardFilter === 'all'
      ? warriors
      : warriors.filter((warrior) => warrior.stage === leaderboardFilter);
    return [...filtered].sort((a, b) => sortMode === 'strength' ? b.strength - a.strength : b.growth - a.growth);
  }, [leaderboardFilter, sortMode]);

  const handleAction = (message: string, target?: string) => {
    setNotice(message);
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText('STONKALICIOUS / CONTRACT TBD');
      setCopied(true);
      setNotice('Contract label copied. The live address will be published with mint details.');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setNotice('Contract details will be published with the mint announcement.');
    }
  };

  return (
    <main className="noise site-shell min-h-[100dvh] text-[#202534]">
      {notice && (
        <div role="status" data-testid="status-cta-feedback" className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 border border-[#202534] bg-[#202534] px-4 py-3 text-sm text-[#eee9dd] shadow-[6px_6px_0_#ec642f]">
          <CircleCheck className="h-4 w-4 text-[#f5bf58]" />
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notification" data-testid="button-dismiss-feedback" onClick={() => setNotice('')} className="ml-2 text-[#b8b5ae] hover:text-[#f5bf58]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 md:px-10" data-testid="navigation-main">
        <a href="#top" data-testid="link-home"><BrandMark /></a>
        <div className="hidden items-center gap-8 md:flex">
          {[
            ['the mirror', '#mirror'],
            ['evolution', '#evolution'],
            ['leaderboard', '#leaderboard'],
            ['rules', '#rules'],
          ].map(([label, href]) => (
            <a key={href} href={href} data-testid={`link-nav-${label.replace(' ', '-')}`} className="mono-face text-[10px] text-[#6e6b72] transition-colors hover:text-[#ec642f]">{label}</a>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button type="button" onClick={() => handleAction('Mint details are being locked. Join the signal to get the first drop notice.', 'mint')} data-testid="button-nav-mint" className="button-cut border-2 border-[#202534] bg-[#ec642f] px-5 py-3 font-bold text-[#eee9dd] transition-transform hover:-translate-y-0.5">
            mint a warrior <ArrowUpRight className="ml-1 inline h-4 w-4" />
          </button>
        </div>
        <button type="button" aria-label="Open menu" data-testid="button-open-menu" className="md:hidden" onClick={() => setMobileNavOpen((open) => !open)}>
          {mobileNavOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {mobileNavOpen && (
        <div className="mx-5 mb-5 border-2 border-[#202534] bg-[#eee9dd] p-5 md:hidden" data-testid="menu-mobile">
          <div className="grid gap-4">
            {[
              ['the mirror', '#mirror'],
              ['evolution', '#evolution'],
              ['leaderboard', '#leaderboard'],
              ['rules', '#rules'],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileNavOpen(false)} data-testid={`link-mobile-${label.replace(' ', '-')}`} className="mono-face border-b border-[#202534]/15 pb-3 text-xs">{label}</a>
            ))}
            <button type="button" onClick={() => handleAction('Mint details are being locked. Join the signal to get the first drop notice.', 'mint')} data-testid="button-mobile-mint" className="button-cut bg-[#ec642f] px-4 py-3 text-left font-bold text-[#eee9dd]">mint a warrior <ArrowUpRight className="inline h-4 w-4" /></button>
          </div>
        </div>
      )}

      <section id="top" className="mx-auto grid max-w-[1320px] gap-12 px-5 pb-24 pt-10 md:grid-cols-[1.04fr_.96fr] md:items-center md:px-10 md:pb-36 md:pt-16">
        <div className="reveal-up">
          <div className="mono-face mb-7 flex items-center gap-3 text-[10px] text-[#ec642f]">
            <span className="h-px w-10 bg-[#ec642f]" /> dynamic nft / robinhood chain
          </div>
          <h1 className="display-face max-w-[760px] text-[clamp(4rem,10vw,8.8rem)] font-extrabold leading-[.82]">
             who’s<br /><span className="text-[#ec642f]">king</span> of the<br />Hood?
          </h1>
          <p className="mt-9 max-w-[510px] text-lg leading-relaxed text-[#5c5b62] md:text-xl">
              Stonkalicious turns portfolio performance into a body. One warrior, eight levels of market trauma, and an on-chain mirror that cannot be faked. Your bag writes the answer.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => handleAction('Mint details are coming with the collection announcement. No wallet connection is requested yet.', 'mint')} data-testid="button-hero-mint" className="button-cut bg-[#202534] px-6 py-4 font-bold text-[#eee9dd] transition-transform hover:-translate-y-1">
              enter the arena <ArrowUpRight className="ml-2 inline h-4 w-4 text-[#f5bf58]" />
            </button>
            <a href="#evolution" data-testid="link-see-evolution" className="group flex items-center gap-2 px-2 py-3 font-bold">
              see the evolution <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
          <div className="mt-16 flex flex-wrap gap-x-8 gap-y-4 border-t border-[#202534]/15 pt-5 text-[11px] text-[#6e6b72]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4a8b68]" /> no vaults. no token.</span>
            <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> allowlist only</span>
            <span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5" /> transfer resets</span>
          </div>
        </div>

        <div className="reveal-up delay-2 relative flex min-h-[520px] items-center justify-center overflow-hidden border-2 border-[#202534] bg-[#272b3a] px-5 py-10 scanline">
          <div className="absolute left-5 top-5 mono-face text-[9px] text-[#aaa7a0]">live specimen / 0001</div>
          <div className="absolute right-5 top-5 flex items-center gap-2 mono-face text-[9px] text-[#f5bf58]"><span className="h-1.5 w-1.5 rounded-full bg-[#f5bf58]" /> sync ready</div>
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between border-t border-[#eee9dd]/20 pt-3">
            <div>
              <div className="mono-face text-[9px] text-[#aaa7a0]">current stage</div>
              <div className="display-face mt-1 text-3xl text-[#eee9dd]">{selectedStage.name}</div>
            </div>
            <div className="text-right">
              <div className="mono-face text-[9px] text-[#aaa7a0]">orb status</div>
              <div className="mt-1 font-mono text-sm text-[#f5bf58]">charged / 94</div>
            </div>
          </div>
          <WarriorIllustration stage={activeStage} />
        </div>
      </section>

      <section className="border-y-2 border-[#202534] bg-[#202534] text-[#eee9dd]" aria-label="Collection facts" data-testid="section-collection-facts">
        <div className="mx-auto grid max-w-[1320px] md:grid-cols-4">
          {[
             ['8', 'market-tested levels'],
             ['1', 'warrior per wallet'],
             ['1:1', 'wallet / X identity'],
            ['∞', 'reasons to keep building'],
          ].map(([value, label], index) => (
            <div key={label} className={`px-5 py-7 md:px-10 ${index < 3 ? 'border-b border-[#eee9dd]/15 md:border-b-0 md:border-r' : ''}`}>
              <div className="display-face text-4xl text-[#f5bf58]">{value}</div>
              <div className="mono-face mt-2 text-[9px] text-[#aaa7a0]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="mirror" className="mx-auto max-w-[1320px] scroll-mt-10 px-5 py-24 md:px-10 md:py-36">
        <div className="grid gap-14 md:grid-cols-[.8fr_1.2fr] md:items-end">
          <div>
            <div className="mono-face mb-5 text-[10px] text-[#ec642f]">01 / the mirror</div>
            <h2 className="display-face max-w-[520px] text-5xl font-bold leading-[.9] md:text-7xl">Your NFT does not hold the bag.<br /><span className="text-[#7666c9]">It holds up a mirror.</span></h2>
          </div>
          <div className="max-w-[490px]">
             <p className="text-lg leading-relaxed text-[#5c5b62]">One wallet, one warrior, one public performance identity. The warrior reads the current owner’s allowlisted holdings and turns the live high, low, and current position into a shareable status symbol.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                [WalletCards, 'reads the owner', 'Current wallet, current reality.'],
                [TrendingUp, 'tracks the climb', 'ROI since your snapshot.'],
               [Activity, 'keeps the record', 'One profile. One performance history.'],
              ].map(([Icon, title, copy]) => {
                const IconComponent = Icon as typeof WalletCards;
                return <div key={title as string} className="border-l-2 border-[#ec642f] pl-4"><IconComponent className="mb-3 h-5 w-5 text-[#ec642f]" /><div className="font-bold">{title as string}</div><div className="mt-1 text-sm text-[#6e6b72]">{copy as string}</div></div>;
              })}
            </div>
          </div>
        </div>
        <div className="mt-20 grid-paper border-2 border-[#202534] p-5 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="bg-[#eee9dd] p-5">
              <div className="mono-face text-[9px] text-[#6e6b72]">snapshot / day zero</div>
              <div className="mt-3 font-mono text-2xl">$34,820</div>
              <div className="mt-2 text-sm text-[#6e6b72]">your bag when the warrior became yours</div>
            </div>
            <ArrowDownUp className="hidden h-7 w-7 text-[#ec642f] md:block" />
            <div className="bg-[#eee9dd] p-5">
              <div className="mono-face text-[9px] text-[#6e6b72]">wallet mirror / now</div>
              <div className="mt-3 font-mono text-2xl text-[#4a8b68]">$76,340</div>
              <div className="mt-2 text-sm text-[#6e6b72]">the current owner’s allowlisted value</div>
            </div>
            <ArrowDownUp className="hidden h-7 w-7 text-[#ec642f] md:block" />
            <div className="bg-[#202534] p-5 text-[#eee9dd]">
              <div className="mono-face text-[9px] text-[#aaa7a0]">visual output / now</div>
              <div className="mt-3 display-face text-3xl text-[#f5bf58]">Hardened</div>
              <div className="mt-2 text-sm text-[#aaa7a0]">a stronger bag gets a stronger body</div>
            </div>
          </div>
          <div className="mt-8 grid gap-4 border-t border-[#202534]/15 pt-5 sm:grid-cols-3">
            {[
              ['ROI', '+120%', 'how hard the bag climbed'],
              ['TIME', '184 days', 'how long you stayed in'],
              ['TOTAL', '$76,340', 'current eligible value'],
            ].map(([label, value, copy]) => (
              <div key={label} className="border-l-2 border-[#ec642f] pl-4">
                <div className="mono-face text-[9px] text-[#6e6b72]">{label}</div>
                <div className="mt-1 font-mono text-lg">{value}</div>
                <div className="mt-1 text-xs text-[#6e6b72]">{copy}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#202534]/15 pt-5">
            <div className="flex items-center gap-2 text-sm text-[#5c5b62]"><Activity className="h-4 w-4 text-[#4a8b68]" /> No live wallet connection here — this is the product promise.</div>
            <button type="button" onClick={copyContract} data-testid="button-copy-contract" className="mono-face flex items-center gap-2 text-[9px] text-[#6e6b72] hover:text-[#ec642f]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'copied' : 'copy launch label'}</button>
          </div>
        </div>
      </section>

      <section id="evolution" className="scroll-mt-10 bg-[#ded7c8] py-24 md:py-36" data-testid="section-evolution">
        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mono-face mb-5 text-[10px] text-[#ec642f]">02 / the evolution</div>
              <h2 className="display-face text-5xl font-bold leading-[.9] md:text-7xl">Eight levels.<br /><span className="text-[#ec642f]">No shortcuts.</span></h2>
            </div>
            <p className="max-w-[340px] text-base leading-relaxed text-[#5c5b62]">Choose a level. Watch the same character mutate as the numbers behind him do.</p>
          </div>
          <div className="grid gap-10 md:grid-cols-[.72fr_1.28fr] md:items-center">
            <div className="order-2 grid gap-2 md:order-1">
              {stages.map((stage) => (
                <button type="button" key={stage.key} onClick={() => setActiveStage(stage.key)} data-testid={`button-stage-${stage.key}`} className={`group flex items-center justify-between border-b border-[#202534]/15 py-5 text-left transition-all ${activeStage === stage.key ? 'pl-4 text-[#202534]' : 'text-[#6e6b72] hover:pl-2 hover:text-[#202534]'}`}>
                  <span className="flex items-center gap-5"><span className="mono-face text-[10px]" style={{ color: activeStage === stage.key ? stage.color : undefined }}>{stage.number}</span><span className="display-face text-3xl font-bold">{stage.name}</span></span>
                  <span className="h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: stage.color, opacity: activeStage === stage.key ? 1 : .45 }} />
                </button>
              ))}
              <div className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-[#6e6b72]"><MousePointer2 className="mt-1 h-4 w-4 shrink-0 text-[#ec642f]" /> This is a visual readout, not a promise of a specific live score.</div>
            </div>
            <div className="order-1 flex min-h-[530px] items-center justify-center border-2 border-[#202534] bg-[#272b3a] p-5 md:order-2 md:p-10">
              <div className="relative w-full max-w-[680px]">
                <div className="absolute left-0 top-0 mono-face text-[9px] text-[#aaa7a0]">{selectedStage.threshold}</div>
                <div className="absolute right-0 top-0 text-right"><div className="mono-face text-[9px] text-[#aaa7a0]">trait</div><div className="mt-1 text-sm text-[#eee9dd]">{selectedStage.trait}</div></div>
                <div className="flex justify-center pt-10"><WarriorIllustration stage={activeStage} /></div>
                <div className="mt-[-20px] border-t border-[#eee9dd]/20 pt-4"><p className="max-w-[500px] text-sm leading-relaxed text-[#aaa7a0]">{selectedStage.description}</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="rules" className="mx-auto max-w-[1320px] scroll-mt-10 px-5 py-24 md:px-10 md:py-36" data-testid="section-rules">
        <div className="grid gap-14 md:grid-cols-[.9fr_1.1fr]">
          <div>
            <div className="mono-face mb-5 text-[10px] text-[#ec642f]">03 / the rules of the ring</div>
            <h2 className="display-face text-5xl font-bold leading-[.9] md:text-7xl">The flex is<br /><span className="text-[#4a8b68]">the visual.</span></h2>
            <p className="mt-8 max-w-[390px] text-lg leading-relaxed text-[#5c5b62]">A clean system for a messy market. The warrior only responds to signals we can actually defend.</p>
          </div>
          <div className="grid gap-3">
            {[
              [Shield, 'One identity per warrior', 'One wallet gets one warrior. One verified X profile gets one active performance identity.'],
              [WalletCards, 'Allowlisted assets only', 'Official Robinhood tokenized stocks and ETFs, plus a short fixed list of large Robinhood Chain coins.'],
              [Flame, 'Capped coin contribution', 'Allowlisted coins count, but a meme pump cannot instantly summon a Tier 4 warrior.'],
              [RotateCcw, 'Transfer means reset', 'When the NFT moves, its snapshot moves with it. The new owner starts fresh. The warrior can drop tiers.'],
            ].map(([Icon, title, copy], index) => {
              const IconComponent = Icon as typeof Shield;
              return <article key={title as string} className="group border-2 border-[#202534] p-6 transition-colors hover:bg-[#202534] hover:text-[#eee9dd] md:p-8"><div className="flex gap-6"><div className="grid h-11 w-11 shrink-0 place-items-center bg-[#f5bf58] text-[#202534]"><IconComponent className="h-5 w-5" /></div><div><div className="mono-face mb-2 text-[9px] text-[#ec642f]">0{index + 1}</div><h3 className="display-face text-3xl font-bold">{title as string}</h3><p className="mt-3 max-w-[530px] text-base leading-relaxed text-[#6e6b72] group-hover:text-[#aaa7a0]">{copy as string}</p></div></div></article>;
            })}
          </div>
        </div>
      </section>

      <section id="leaderboard" className="scroll-mt-10 bg-[#202534] py-24 text-[#eee9dd] md:py-36" data-testid="section-leaderboard">
        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <div className="mono-face mb-5 text-[10px] text-[#f5bf58]">04 / public signal</div>
              <h2 className="display-face text-5xl font-bold leading-[.9] md:text-7xl">Who is<br /><span className="text-[#ec642f]">still climbing?</span></h2>
            </div>
            <p className="max-w-[330px] leading-relaxed text-[#aaa7a0]">The FOMO loop, made collectible. Rank by total strength, ROI, or time spent surviving the market.</p>
          </div>
          <div className="mt-12 flex flex-col justify-between gap-4 border-y border-[#eee9dd]/15 py-4 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter leaderboard by stage">
              {(['all', ...stages.map((stage) => stage.key)] as const).map((filter) => (
                <button type="button" key={filter} onClick={() => setLeaderboardFilter(filter)} data-testid={`button-filter-${filter}`} className={`mono-face border px-3 py-2 text-[9px] transition-colors ${leaderboardFilter === filter ? 'border-[#f5bf58] bg-[#f5bf58] text-[#202534]' : 'border-[#eee9dd]/20 text-[#aaa7a0] hover:border-[#f5bf58] hover:text-[#f5bf58]'}`}>{filter === 'all' ? 'all warriors' : filter}</button>
              ))}
            </div>
            <button type="button" onClick={() => setSortMode(sortMode === 'strength' ? 'growth' : 'strength')} data-testid="button-sort-leaderboard" className="mono-face flex items-center gap-2 text-[9px] text-[#f5bf58] hover:text-[#eee9dd]"><SlidersHorizontal className="h-3.5 w-3.5" /> sort: {sortMode === 'strength' ? 'total value' : 'ROI'} <ChevronDown className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] gap-4 px-4 py-3 mono-face text-[9px] text-[#777985]"><span>#</span><span>warrior / wallet</span><span>level</span><span>total value</span><span>ROI since snapshot</span></div>
              {visibleWarriors.map((warrior, index) => {
                const stage = stages.find((item) => item.key === warrior.stage) ?? stages[0];
                return <div key={warrior.name} data-testid={`row-leaderboard-${warrior.name}`} className="grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] items-center gap-4 border-t border-[#eee9dd]/15 px-4 py-5 transition-colors hover:bg-[#2b3042]"><span className={`font-mono text-sm ${index === 0 ? 'text-[#f5bf58]' : 'text-[#777985]'}`}>{String(index + 1).padStart(2, '0')}</span><div><div className="font-bold">{warrior.name}</div><div className="mt-1 font-mono text-[10px] text-[#777985]">{warrior.wallet} / {warrior.bag}</div></div><span className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.name}</span><span className="font-mono text-[#f5bf58]">{warrior.bag}</span><span className="font-mono text-[#4a8b68]">+{warrior.growth}%</span></div>;
              })}
              {visibleWarriors.length === 0 && <div className="border-t border-[#eee9dd]/15 py-14 text-center text-[#aaa7a0]" data-testid="empty-leaderboard">No warriors at this stage yet. The arena is still open.</div>}
            </div>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-[#777985]"><Swords className="h-4 w-4 text-[#ec642f]" /> Preview data for the showcase. Public ranking arrives with the live metadata layer.</div>
        </div>
      </section>

      <section id="mint" className="mx-auto max-w-[1320px] scroll-mt-10 px-5 py-24 md:px-10 md:py-36" data-testid="section-mint">
        <div className="relative overflow-hidden border-2 border-[#202534] bg-[#f5bf58] p-7 md:p-14">
          <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full border-[30px] border-[#ec642f]/20" />
          <div className="absolute -bottom-28 right-24 h-72 w-72 rounded-full border border-[#202534]/15" />
          <div className="relative grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-end">
            <div>
              <div className="mono-face mb-5 text-[10px] text-[#ec642f]">05 / claim your mirror</div>
              <h2 className="display-face max-w-[750px] text-5xl font-bold leading-[.86] md:text-8xl">Make your<br />performance<br /><span className="text-[#ec642f]">visible.</span></h2>
            </div>
            <div>
             <p className="text-lg leading-relaxed text-[#4c4b51]">One wallet gets one warrior. Link your X profile to claim your public performance identity, then let the market write the record.</p>
              <button type="button" onClick={() => handleAction('You are on the shortlist. Launch updates will be shared with the community.', 'community')} data-testid="button-join-signal" className="button-cut mt-7 bg-[#202534] px-6 py-4 font-bold text-[#eee9dd] transition-transform hover:-translate-y-1">join the signal <ArrowUpRight className="ml-2 inline h-4 w-4 text-[#f5bf58]" /></button>
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="border-t-2 border-[#202534] bg-[#ded7c8]" data-testid="section-community">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 md:grid-cols-[1fr_auto] md:items-center md:px-10">
          <div><div className="mono-face text-[10px] text-[#ec642f]">the arena is social</div><h2 className="display-face mt-4 text-4xl font-bold md:text-6xl">Bring a body to the bag.</h2></div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => handleAction('Community channels open with the first collection update.', 'community')} data-testid="button-community-updates" className="button-cut border-2 border-[#202534] px-5 py-3 font-bold hover:bg-[#202534] hover:text-[#eee9dd]">get updates <ExternalLink className="ml-2 inline h-4 w-4" /></button>
            <a href="#leaderboard" data-testid="link-community-leaderboard" className="button-cut bg-[#ec642f] px-5 py-3 font-bold text-[#eee9dd]">watch the ranks <ArrowUpRight className="ml-2 inline h-4 w-4" /></a>
          </div>
        </div>
      </section>

       <section id="risk" className="border-t-2 border-[#202534] bg-[#ec642f] px-5 py-14 text-[#202534] md:px-10 md:py-20" data-testid="section-risk">
         <div className="mx-auto grid max-w-[1320px] gap-6 md:grid-cols-[auto_1fr] md:items-start md:gap-10">
           <div className="mono-face border-2 border-[#202534] px-3 py-2 text-[10px] font-bold">high risk / read this</div>
           <div className="max-w-[900px]">
             <h2 className="display-face text-3xl font-bold leading-none md:text-5xl">Expect to lose everything.</h2>
             <p className="mt-5 text-base leading-relaxed md:text-lg">Stonkalicious is an experimental digital collectible and on-chain performance mirror, not financial advice, an investment, a security, or a promise of profit. Robinhood Chain assets and crypto assets are highly volatile. You may lose some or all of the money you spend, including 100% of your purchase.</p>
             <p className="mt-4 text-sm leading-relaxed opacity-80">To the fullest extent permitted by applicable law, Stonkalicious and its creators are not liable for losses, market moves, smart-contract bugs, wallet errors, outages, metadata delays, launch issues, or other damage connected with using or acquiring a warrior. Do your own research and only participate with money you can afford to lose.</p>
           </div>
         </div>
       </section>

      <footer className="bg-[#202534] px-5 py-8 text-[#aaa7a0] md:px-10">
        <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center border border-[#f5bf58]"><span className="h-3 w-3 rounded-full bg-[#ec642f]" /></div><span className="display-face text-lg text-[#eee9dd]">stonkalicious</span></div>
           <div className="mono-face text-[9px]">dynamic nft / robinhood chain / 2026</div>
           <div className="flex flex-wrap gap-5 text-sm"><a href="#rules" data-testid="link-footer-rules" className="hover:text-[#f5bf58]">rules</a><a href="#risk" data-testid="link-footer-risk" className="hover:text-[#f5bf58]">risk notice</a><a href="#mint" data-testid="link-footer-mint" className="hover:text-[#f5bf58]">mint</a><a href="#top" data-testid="link-footer-top" className="hover:text-[#f5bf58]">back to top ↑</a></div>
        </div>
         <div className="mx-auto mt-6 max-w-[1320px] border-t border-[#eee9dd]/15 pt-5 text-[10px] leading-relaxed text-[#777985]">Digital collectibles are high risk. No guarantee of value, liquidity, uptime, or future performance. This notice is not a substitute for advice from a qualified lawyer or financial professional.</div>
      </footer>
    </main>
  );
}

export default App;