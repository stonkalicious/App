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
  Link2,
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
import {
  WARRIOR_ARTWORK_MAP,
  type WarriorArtworkStatus,
  type WarriorStageKey,
} from '@workspace/warrior-config';

type StageKey = WarriorStageKey;

type Stage = {
  key: StageKey;
  number: string;
  name: string;
  threshold: string;
  description: string;
  trait: string;
  color: string;
  image: string;
  artworkStatus: WarriorArtworkStatus;
  artworkBlocker?: string;
};

type Warrior = {
  rank: number;
  name: string;
  wallet: string;
  stage: StageKey;
  strength: number;
  pnl: number;
  growthPct: number;
  bag: string;
  holderRank: number;
  holderCount: number;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type IdentityStatusResponse = {
  status: 'anonymous' | 'unavailable' | 'wallet_pending' | 'oauth_pending' | 'ready' | 'failed';
  walletVerified?: boolean;
  xVerified?: boolean;
  mintAuthorizationAvailable?: boolean;
  errorCode?: string;
};

type IdentityKind = 'wallet' | 'x';

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const stageDefinitions: Array<[StageKey, string, string, string, string]> = [
  ['newb', '0–12 strength', 'Everyone starts here. The orb is warm, the bag is small, and the first signal is still ahead.', 'open face / soft purple energy', '#7666c9'],
  ['liquidated', '13–24 strength', 'The first real momentum shows. The orb catches heat and the run has room to grow.', 'first momentum / warm glow', '#8d4654'],
  ['back', '25–36 strength', 'The comeback becomes a contest. The NFT has a plan, a pulse, and something to defend.', 'patched kit / contender spark', '#bd7653'],
  ['wrecked', '37–48 strength', 'The bag is taking shape. Layer by layer, the orb carries more weight and the signal gets louder.', 'layered kit / stacked glow', '#a75a48'],
  ['hardened', '49–60 strength', '', 'battle helmet / real fire', '#df7e3c'],
  ['profitable', '61–72 strength', 'The numbers have become a discipline. Every move sharpens the shape of the run.', 'war paint / master glow', '#d99a48'],
  ['elite', '73–88 strength', 'A battle-worn status symbol. Bright flames, a hard gaze, and nothing left to prove.', 'worn armor / bright aura', '#f5bf58'],
  ['plumber', '89+ strength', 'The Final Form', 'mythic kit / maxed-out aura', '#e8d8ac'],
 ];

const stages: Stage[] = stageDefinitions.map(([key, threshold, description, trait, color], index) => {
  const artwork = WARRIOR_ARTWORK_MAP[key];
  return {
    key,
    number: String(index + 1).padStart(2, '0'),
    name: artwork.level,
    threshold,
    description,
    trait,
    color,
    image: `/warriors/${artwork.filename}`,
    artworkStatus: artwork.status,
    artworkBlocker: artwork.blocker,
  };
});

const warriors: Warrior[] = [
  { rank: 1, name: 'orbital_ronin', wallet: '0x7F…91A2', stage: 'plumber', strength: 94, pnl: 218400, growthPct: 184, bag: '$482,190', holderRank: 1, holderCount: 247 },
  { rank: 2, name: 'marauder.eth', wallet: '0xD2…4F10', stage: 'elite', strength: 88, pnl: 167900, growthPct: 142, bag: '$301,842', holderRank: 2, holderCount: 247 },
  { rank: 3, name: 'cold_storage', wallet: '0xA8…BC33', stage: 'hardened', strength: 73, pnl: 112600, growthPct: 118, bag: '$188,460', holderRank: 3, holderCount: 247 },
  { rank: 4, name: 'redline_rider', wallet: '0x3C…008E', stage: 'hardened', strength: 68, pnl: 92300, growthPct: 93, bag: '$124,707', holderRank: 4, holderCount: 247 },
  { rank: 5, name: 'smallcap_samurai', wallet: '0x11…E2A9', stage: 'wrecked', strength: 46, pnl: 71800, growthPct: 71, bag: '$76,340', holderRank: 5, holderCount: 247 },
  { rank: 6, name: 'index_apprentice', wallet: '0xBE…771C', stage: 'back', strength: 38, pnl: 48700, growthPct: 48, bag: '$44,920', holderRank: 6, holderCount: 247 },
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
  const stageDetails = stages.find((item) => item.key === stage) ?? stages[0];
  return (
    <div className={`warrior-art warrior-float level-${stage}`} aria-label={`${stageDetails.name} NFT visual`} data-artwork-status={stageDetails.artworkStatus} data-testid={`illustration-warrior-${stage}`}>
      {stageDetails.artworkStatus === 'blocked' ? (
        <div className="absolute inset-0 z-[1] grid place-items-center bg-[#202534] p-6 text-center text-[#eee9dd]">
          <div>
            <div className="mono-face text-[9px] text-[#ec642f]">artwork blocked</div>
            <div className="display-face mt-3 text-3xl text-[#f5bf58]">{stageDetails.name}</div>
            <div className="mt-3 text-xs leading-relaxed text-[#aaa7a0]">Approved {stageDetails.name} artwork is pending. No other tier is shown in its place.</div>
          </div>
        </div>
      ) : (
        <img src={stageDetails.image} alt={`${stageDetails.name} Stonkalicious NFT`} />
      )}
      <div className="artwork-glow" />
    </div>
  );
}

function formatGrowth(value: number) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value)}%`;
}

function formatReferralCode(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
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
      </div>
    </div>
  );
}

function App() {
  const [activeStage, setActiveStage] = useState<StageKey>('hardened');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | StageKey>('all');
  const [sortMode, setSortMode] = useState<'rank' | 'growth'>('growth');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [previewWallet, setPreviewWallet] = useState('');
  const [referrer, setReferrer] = useState('');
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [identityState, setIdentityState] = useState<'idle' | 'signing' | 'oauth' | 'success' | 'error' | 'unavailable'>('idle');
  const [identityKind, setIdentityKind] = useState<IdentityKind | null>(null);
  const [verificationIntent, setVerificationIntent] = useState<IdentityKind | null>(null);
  const [identityError, setIdentityError] = useState('');
  const [identityBusy, setIdentityBusy] = useState(false);
  const selectedStage = stages.find((stage) => stage.key === activeStage) ?? stages[7];
  const startStage = stages[0];
  const previewStage = stages.find((stage) => stage.key === 'hardened') ?? stages[4];
  const previewRank = 12;
  const previewHolderCount = 247;
  const referralLink = previewWallet
    ? `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(previewWallet.toLowerCase())}#watch`
    : '';

  useEffect(() => {
     document.title = 'King of the Hood';
     setMeta('description', 'Stonkalicious is an experimental Robinhood Chain collectible with illustrative performance previews.');
     setMeta('', 'King of the Hood', 'og:title');
     setMeta('', 'An experimental Robinhood Chain collectible with illustrative previews. No custody. No wallet approvals.', 'og:description');
    setMeta('', 'website', 'og:type');
    setMeta('', window.location.href, 'og:url');
    setMeta('twitter:card', 'summary_large_image');
     setMeta('twitter:title', 'King of the Hood');
     setMeta('twitter:description', 'An experimental Robinhood Chain collectible with illustrative previews. No custody. No wallet approvals.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verification = params.get('verification');
    const reason = params.get('reason') ?? '';
    const incomingRef = params.get('ref');
    if (incomingRef) setReferrer(incomingRef);
    if (verification === 'success') {
      setIdentityState('success');
      setIdentityKind('x');
    }
    if (verification === 'error') {
      setIdentityState('error');
      setIdentityError(reason);
    }
    if (verification) window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    void fetch('/api/identity/status', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return;
        const status = await response.json() as IdentityStatusResponse;
        if (status.status === 'ready') {
          setIdentityState('success');
          setIdentityKind(status.xVerified ? 'x' : 'wallet');
        }
        if (status.status === 'failed') {
          setIdentityState('error');
          setIdentityError(status.errorCode ?? '');
        }
        if (status.status === 'unavailable') setIdentityState('unavailable');
      })
      .catch(() => setIdentityState('unavailable'));
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
    return [...filtered].sort((a, b) => sortMode === 'rank' ? a.holderRank - b.holderRank : b.growthPct - a.growthPct);
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

  const copyShareCaption = async () => {
    const caption = `Example only: ${selectedStage.name} · example rank #12 · example change +71% since snapshot.`;
    try {
      await navigator.clipboard.writeText(caption);
      setShareCopied(true);
      setNotice('Share caption copied.');
      window.setTimeout(() => setShareCopied(false), 2400);
    } catch {
      setNotice(`Example share caption: “${caption}”`);
    }
  };

  const copyReferralLink = async () => {
    if (!referralLink) {
      setNotice('Connect your wallet first to generate your referral link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setNotice('Share URL copied. It carries no reward or purchase credit.');
      window.setTimeout(() => setReferralCopied(false), 2400);
    } catch {
      setNotice(`Referral link: ${referralLink}`);
    }
  };

  const previewWalletPerformance = async () => {
    if (!window.ethereum) {
      setPreviewState('error');
      setNotice('A compatible wallet is needed for the read-only preview.');
      return;
    }
    setPreviewState('loading');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const wallet = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
      if (!wallet) throw new Error('invalid_wallet');
      setPreviewWallet(wallet);
      setPreviewState('ready');
      setNotice('Read-only preview loaded. This warrior is not minted.');
    } catch {
      setPreviewState('error');
      setNotice('Wallet preview did not load. No approval or transaction was requested.');
    }
  };

  const identityErrorCopy = (code: string) => {
    if (code === 'verification_unavailable') {
      return verificationIntent === 'x'
        ? 'Optional X linking is temporarily unavailable. No wallet permission was requested.'
        : 'Wallet verification is temporarily unavailable. No wallet permission was requested.';
    }
    return ({
    invalid_wallet: 'Your wallet address was not accepted. Try again with a compatible EVM wallet.',
    wallet_signature_invalid: 'The wallet proof did not match this wallet. Nothing was submitted or approved.',
    wallet_challenge_expired: 'That wallet proof expired. Start again to receive a fresh challenge.',
    x_denied: 'X verification was cancelled. You can safely try again.',
    state_invalid: 'The verification link could not be trusted. Start again from this page.',
    identity_already_bound: 'That X identity already has an active NFT.',
    wallet_already_claimed: 'That wallet already has its lifetime NFT.',
    mint_signer_mismatch: 'Mint authorization is temporarily unavailable. No transaction was opened.',
    claim_in_progress: 'This wallet or X identity is already being verified in another session.',
    oauth_already_started: 'The X verification window is already in progress. Finish it or try again.',
    x_verification_unavailable: 'Optional X linking is not configured for this preview.',
    wallet_challenge_required: 'Start with wallet verification before requesting an optional identity link.',
    verification_unavailable: 'Verification is temporarily unavailable. No wallet permission was requested.',
    } as Record<string, string>)[code] ?? 'Verification did not complete. Try again from this page.';
  };

  const proveWallet = async () => {
    if (!window.ethereum) {
      throw new Error('wallet_missing');
    }
    setIdentityState('signing');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const wallet = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
    if (!wallet) throw new Error('invalid_wallet');
    const challengeResponse = await fetch('/api/identity/challenge', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet }),
    });
    const challenge = await challengeResponse.json() as { message?: string; challengeId?: string; error?: string };
    if (!challengeResponse.ok || !challenge.message || !challenge.challengeId) throw new Error(challenge.error ?? 'verification_unavailable');
    return window.ethereum.request({
      method: 'personal_sign',
      params: [challenge.message, wallet],
    });
  };

  const startWalletVerification = async () => {
    setIdentityBusy(true);
    setVerificationIntent('wallet');
    setIdentityError('');
    try {
      const signature = await proveWallet();
      const authorizationResponse = await fetch('/api/identity/wallet/authorize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signature }),
      });
      const authorization = await authorizationResponse.json() as { error?: string };
      if (!authorizationResponse.ok) throw new Error(authorization.error ?? 'verification_unavailable');
      setIdentityKind('wallet');
      setIdentityState('success');
    } catch (error) {
      setIdentityState('error');
      setIdentityError(error instanceof Error ? error.message : 'verification_unavailable');
    } finally {
      setIdentityBusy(false);
    }
  };

  const startIdentityVerification = async () => {
    setIdentityBusy(true);
    setVerificationIntent('x');
    setIdentityError('');
    try {
      const signature = await proveWallet();
      const startResponse = await fetch('/api/identity/x/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signature }),
      });
      const start = await startResponse.json() as { authorizeUrl?: string; error?: string };
      if (!startResponse.ok || !start.authorizeUrl) throw new Error(start.error ?? 'verification_unavailable');
      setIdentityKind('x');
      setIdentityState('oauth');
      window.location.assign(start.authorizeUrl);
    } catch (error) {
      setIdentityState('error');
      setIdentityError(error instanceof Error ? error.message : 'verification_unavailable');
      setIdentityBusy(false);
    }
  };

  const resetIdentityVerification = async () => {
    setIdentityBusy(true);
    try {
      await fetch('/api/identity/reset', { method: 'POST', credentials: 'include' });
    } finally {
      setIdentityState('idle');
      setIdentityKind(null);
      setVerificationIntent(null);
      setIdentityError('');
      setIdentityBusy(false);
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
            ['watch my warrior', '#watch'],
            ['evolution', '#evolution'],
            ['leaderboard', '#leaderboard'],
            ['rules', '#rules'],
          ].map(([label, href]) => (
            <a key={href} href={href} data-testid={`link-nav-${label.replace(' ', '-')}`} className="mono-face text-[10px] text-[#6e6b72] transition-colors hover:text-[#ec642f]">{label}</a>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button type="button" onClick={() => handleAction('Mint details are being locked. Join the signal to get the first drop notice.', 'mint')} data-testid="button-nav-mint" className="button-cut border-2 border-[#202534] bg-[#ec642f] px-5 py-3 font-bold text-[#eee9dd] transition-transform hover:-translate-y-0.5">
            get launch access <ArrowUpRight className="ml-1 inline h-4 w-4" />
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
              ['watch my warrior', '#watch'],
              ['evolution', '#evolution'],
              ['leaderboard', '#leaderboard'],
              ['rules', '#rules'],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileNavOpen(false)} data-testid={`link-mobile-${label.replace(' ', '-')}`} className="mono-face border-b border-[#202534]/15 pb-3 text-xs">{label}</a>
            ))}
            <button type="button" onClick={() => handleAction('Mint details are not live yet. Join the signal for the official launch notice.', 'mint')} data-testid="button-mobile-mint" className="button-cut bg-[#ec642f] px-4 py-3 text-left font-bold text-[#eee9dd]">get launch access <ArrowUpRight className="inline h-4 w-4" /></button>
          </div>
        </div>
      )}

      <section id="top" className="mx-auto grid max-w-[1320px] gap-12 px-5 pb-24 pt-10 md:grid-cols-[1.04fr_.96fr] md:items-center md:px-10 md:pb-36 md:pt-16">
        <div className="reveal-up">
          <div className="mono-face mb-7 flex items-center gap-3 text-[12px] text-[#ec642f]">
            <span className="h-px w-10 bg-[#ec642f]" /> dynamic nft / robinhood chain
          </div>
           <h1 className="max-w-[760px] font-sans text-[clamp(3.75rem,7vw,6.8rem)] font-black leading-[.9] tracking-[-.07em]">
             who’s <span className="text-[#ec642f]">king</span><br />of the<br />Hood?
          </h1>
           <div className="mt-9 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => handleAction('Mint details are being locked. Join the signal to get the first drop notice.', 'mint')} data-testid="button-hero-mint" className="button-cut bg-[#ec642f] px-6 py-4 font-bold text-[#eee9dd] transition-transform hover:-translate-y-1">
                get launch access <ArrowUpRight className="ml-2 inline h-4 w-4 text-[#f5bf58]" />
             </button>
          </div>
          <div className="mt-16 flex flex-wrap gap-x-8 gap-y-4 border-t border-[#202534]/15 pt-5 text-[11px] text-[#6e6b72]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4a8b68]" /> no vaults. no token.</span>
            <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> coin allowlist only</span>
            <span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5" /> transfer resets</span>
          </div>
        </div>

        <div className="reveal-up delay-2 relative overflow-hidden border-2 border-[#202534] bg-[#272b3a] px-4 py-5 scanline sm:px-5 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="mono-face text-[9px] text-[#aaa7a0]">share card / illustrative sample 0001</div>
            <div className="flex items-center gap-2 mono-face text-[9px] text-[#f5bf58]"><span className="h-1.5 w-1.5 rounded-full bg-[#f5bf58]" /> preview mode</div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
               { label: 'start / example', stage: startStage, title: 'Beginning', value: '' },
                { label: 'now / example', stage: selectedStage, title: 'Elite', value: '' },
            ].map((frame) => (
              <div key={frame.label} className="border border-[#eee9dd]/20 bg-[#202534]/45 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="mono-face text-[9px] text-[#aaa7a0]">{frame.label}</div>
                  <div className="mono-face text-[9px]" style={{ color: frame.stage.color }}>{frame.stage.number}</div>
                </div>
                <div className="mt-3 flex justify-center">
                  <div className="w-full max-w-[190px]"><WarriorIllustration stage={frame.stage.key} /></div>
                </div>
                 {(frame.title || frame.value) && <div className="mt-3 border-t border-[#eee9dd]/20 pt-3">
                    {frame.title && <div className="display-face text-2xl text-[#eee9dd]">{frame.title}</div>}
                    {frame.value && <div className="mt-1 font-mono text-xs" style={{ color: frame.stage.color }}>{frame.value}</div>}
                 </div>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee9dd]/20 pt-4">
            <div>
              <div className="mono-face text-[9px] text-[#aaa7a0]">illustrative card / no live result</div>
               <div className="mt-1 text-sm font-bold text-[#eee9dd]">Elite · example rank #12</div>
            </div>
            <button type="button" onClick={() => { void copyShareCaption(); }} data-testid="button-copy-share-caption" className="mono-face flex items-center gap-2 border border-[#f5bf58] px-3 py-2 text-[9px] text-[#f5bf58] transition-colors hover:bg-[#f5bf58] hover:text-[#202534]">
              {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {shareCopied ? 'copied' : 'copy the story'}
            </button>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-[#202534] bg-[#202534] text-[#eee9dd]" aria-label="Collection facts" data-testid="section-collection-facts">
        <div className="mx-auto grid max-w-[1320px] md:grid-cols-4">
          {[
             ['8', 'coin-tested levels'],
             ['1', 'NFT per wallet'],
             ['1:1', 'wallet / optional X'],
             ['∞', 'reasons to keep watching'],
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
            <h2 className="display-face max-w-[520px] text-5xl font-bold leading-[.9] md:text-7xl">An NFT that mirrors<br /><span className="text-[#7666c9]">your bag.</span></h2>
          </div>
          <div className="max-w-[490px]">
              <p className="text-lg leading-relaxed text-[#5c5b62]">One wallet, one NFT, show off your level. When enabled, stonkalicious can read public data for qualifying Robinhood Chain coins to calculate you're dollar ROI. It cannot move, trade, approve, or withdraw your coins. This site will never ask for a seed phrase, private key, or coin approval.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                 [WalletCards, 'read-only by design', 'It observes the wallet. It never controls the wallet.'],
                  [TrendingUp, 'shows the snapshot delta', 'A configured change metric for allowlisted coins.'],
                  [Activity, 'keeps the record', 'One wallet. One performance history.'],
              ].map(([Icon, title, copy]) => {
                const IconComponent = Icon as typeof WalletCards;
                return <div key={title as string} className="border-l-2 border-[#ec642f] pl-4"><IconComponent className="mb-3 h-5 w-5 text-[#ec642f]" /><div className="font-bold">{title as string}</div><div className="mt-1 text-sm text-[#6e6b72]">{copy as string}</div></div>;
              })}
            </div>
          </div>
        </div>
         <div className="mt-20 grid-paper border-2 border-[#202534] p-5 md:p-10">
           <div className="mb-7 flex items-center gap-2 mono-face text-[9px] text-[#ec642f]"><Sparkles className="h-3.5 w-3.5" /> illustrative example / not a live wallet result</div>
          <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="bg-[#eee9dd] p-5">
               <div className="mono-face text-[9px] text-[#6e6b72]">example snapshot / day zero</div>
              <div className="mt-3 font-mono text-2xl">$34,820</div>
               <div className="mt-2 text-sm text-[#6e6b72]">illustrative starting value</div>
            </div>
            <ArrowDownUp className="hidden h-7 w-7 text-[#ec642f] md:block" />
            <div className="bg-[#eee9dd] p-5">
               <div className="mono-face text-[9px] text-[#6e6b72]">example wallet mirror / now</div>
              <div className="mt-3 font-mono text-2xl text-[#4a8b68]">$76,340</div>
               <div className="mt-2 text-sm text-[#6e6b72]">illustrative eligible value</div>
            </div>
            <ArrowDownUp className="hidden h-7 w-7 text-[#ec642f] md:block" />
            <div className="bg-[#202534] p-5 text-[#eee9dd]">
               <div className="mono-face text-[9px] text-[#aaa7a0]">example visual output / now</div>
               <div className="mt-3 display-face text-3xl text-[#f5bf58]">Forged</div>
               <div className="mt-2 text-sm text-[#aaa7a0]">an illustrative state, not an outcome</div>
            </div>
          </div>
          <div className="mt-8 grid gap-4 border-t border-[#202534]/15 pt-5 sm:grid-cols-3">
            {[
               ['CHANGE', '+120% example', 'illustrative snapshot delta'],
               ['TIME', '184 days example', 'illustrative mint age'],
               ['VALUE', '$76,340 example', 'illustrative eligible value'],
            ].map(([label, value, copy]) => (
              <div key={label} className="border-l-2 border-[#ec642f] pl-4">
                <div className="mono-face text-[9px] text-[#6e6b72]">{label}</div>
                <div className="mt-1 font-mono text-lg">{value}</div>
                <div className="mt-1 text-xs text-[#6e6b72]">{copy}</div>
              </div>
            ))}
          </div>
           <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#202534]/15 pt-5">
             <div className="flex items-center gap-2 text-sm text-[#5c5b62]"><Activity className="h-4 w-4 text-[#4a8b68]" /> Connect below for a read-only warrior preview.</div>
            <button type="button" onClick={copyContract} data-testid="button-copy-contract" className="mono-face flex items-center gap-2 text-[9px] text-[#6e6b72] hover:text-[#ec642f]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'copied' : 'copy launch label'}</button>
          </div>
        </div>
      </section>

       <section id="watch" className="scroll-mt-10 border-y-2 border-[#202534] bg-[#f5bf58] py-24 md:py-32" data-testid="section-watch">
         <div className="mx-auto max-w-[1320px] px-5 md:px-10">
           <div className="grid gap-12 md:grid-cols-[.8fr_1.2fr] md:items-end">
             <div>
               <div className="mono-face mb-5 text-[10px] text-[#ec642f]">02 / watch my warrior</div>
                <h2 className="display-face text-5xl font-bold leading-[.9] md:text-7xl">Preview what your<br /><span className="text-[#ec642f]">bag could become.</span></h2>
             </div>
              <p className="max-w-[500px] text-lg leading-relaxed text-[#4c4b51]">Connect a wallet to view the preview flow before any future mint. This demo does not calculate a live wallet score. No approval, transaction, or custody.</p>
           </div>
           <div className="mt-12 grid gap-4 lg:grid-cols-[.78fr_1.22fr]">
             <div className="border-2 border-[#202534] bg-[#eee9dd] p-6 md:p-8">
               <div className="flex items-center justify-between gap-4">
                 <div className="mono-face text-[10px] text-[#ec642f]">wallet check / read-only</div>
                 <LockKeyhole className="h-4 w-4 text-[#4a8b68]" />
               </div>
               <h3 className="display-face mt-8 text-4xl font-bold leading-none">Watch my<br />warrior</h3>
                <p className="mt-5 text-base leading-relaxed text-[#5c5b62]">A wallet can preview the interface before it owns an NFT. If minting opens later, the recorded snapshot would start a new performance run.</p>
               <button type="button" onClick={() => { void previewWalletPerformance(); }} disabled={previewState === 'loading'} data-testid="button-preview-wallet" className="button-cut mt-8 bg-[#202534] px-5 py-4 font-bold text-[#eee9dd] transition-transform hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60">
                 {previewState === 'loading' ? 'checking wallet…' : previewState === 'ready' ? 'refresh preview' : 'connect wallet to preview'} <ArrowUpRight className="ml-2 inline h-4 w-4 text-[#f5bf58]" />
               </button>
               <div className="mt-5 border-l-2 border-[#ec642f] pl-4 text-sm leading-relaxed text-[#6e6b72]" aria-live="polite" data-testid="preview-wallet-status">
                  {previewState === 'idle' && <span>Illustrative form only. Live bag scoring is not enabled in this preview.</span>}
                 {previewState === 'loading' && <span>Wallet access is read-only. No signature or approval is requested.</span>}
                  {previewState === 'ready' && <span>Connected {previewWallet.slice(0, 6)}…{previewWallet.slice(-4)}. Illustrative preview only — this warrior is not minted or live-scored.</span>}
                 {previewState === 'error' && <span>A compatible wallet is needed. No transaction was requested.</span>}
               </div>
                {referrer && (
                  <div className="mt-5 border border-[#4a8b68]/50 bg-[#4a8b68]/10 px-4 py-3 text-sm leading-relaxed text-[#4c4b51]" data-testid="referral-attribution">
                    <Link2 className="mr-2 inline h-4 w-4 text-[#4a8b68]" /> You arrived through warrior link <span className="font-mono text-xs">{formatReferralCode(referrer)}</span>.
                  </div>
                )}
                <div className="mt-5 border-t border-[#202534]/15 pt-5">
                  <div className="flex items-center gap-2 mono-face text-[9px] text-[#ec642f]"><Link2 className="h-3.5 w-3.5" /> your warrior link</div>
                  {referralLink ? (
                    <>
                      <div className="mt-2 break-all font-mono text-[10px] leading-relaxed text-[#6e6b72]" data-testid="referral-link">{referralLink}</div>
                      <button type="button" onClick={() => { void copyReferralLink(); }} data-testid="button-copy-referral" className="mono-face mt-3 flex items-center gap-2 border border-[#ec642f] px-3 py-2 text-[9px] text-[#ec642f] transition-colors hover:bg-[#ec642f] hover:text-[#eee9dd]">
                        {referralCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {referralCopied ? 'copied' : 'copy referral link'}
                      </button>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-[#6e6b72]">Connect your wallet to generate a share URL carrying a ref code. No rewards or attribution credit are promised.</div>
                  )}
                </div>
             </div>
             <div className="border-2 border-[#202534] bg-[#272b3a] p-5 text-[#eee9dd] md:p-8">
               <div className="flex flex-wrap items-start justify-between gap-5">
                 <div>
                    <div className="mono-face text-[9px] text-[#aaa7a0]">illustrative form / preview</div>
                    <div className="display-face mt-2 text-4xl text-[#f5bf58]">Elite</div>
                 </div>
                 <div className="text-right">
                   <div className="mono-face text-[9px] text-[#aaa7a0]">status</div>
                   <div className="mt-2 font-mono text-xs text-[#f5bf58]">not minted</div>
                 </div>
               </div>
               <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
                 <div className="mx-auto w-full max-w-[180px]"><WarriorIllustration stage={previewStage.key} /></div>
                 <div>
                   <div className="border-b border-[#eee9dd]/20 pb-4">
                       <div className="mono-face text-[9px] text-[#aaa7a0]">sample rank / sample holders</div>
                      <div className="mt-2 font-mono text-2xl text-[#eee9dd]">#{previewRank} <span className="text-sm text-[#aaa7a0]">of {previewHolderCount} sample holders</span></div>
                   </div>
                   <div className="border-b border-[#eee9dd]/20 py-4">
                       <div className="mono-face text-[9px] text-[#aaa7a0]">sample growth</div>
                     <div className="mt-2 font-mono text-2xl text-[#4a8b68]">+71%</div>
                     <div className="mt-1 text-xs text-[#aaa7a0]">since the snapshot</div>
                   </div>
                    <div className="pt-4 text-sm leading-relaxed text-[#aaa7a0]"><RotateCcw className="mr-2 inline h-4 w-4 text-[#ec642f]" /> Example only — a live card would show its recorded snapshot and current level.</div>
                 </div>
               </div>
               <div className="mt-6 border border-[#ec642f]/50 bg-[#ec642f]/10 px-4 py-3 text-sm font-bold text-[#f5bf58]">Transfer resets the run. Buying the look does not buy the history.</div>
             </div>
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
             <p className="max-w-[340px] text-base leading-relaxed text-[#5c5b62]">Explore an illustrative level. In a live release, configured public data would determine the displayed state.</p>
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
                 {selectedStage.description && <div className="mt-[-20px] border-t border-[#eee9dd]/20 pt-4"><p className="max-w-[500px] text-sm leading-relaxed text-[#aaa7a0]">{selectedStage.description}</p></div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="rules" className="mx-auto max-w-[1320px] scroll-mt-10 px-5 py-24 md:px-10 md:py-36" data-testid="section-rules">
        <div className="grid gap-14 md:grid-cols-[.9fr_1.1fr]">
          <div>
            <div className="mono-face mb-5 text-[10px] text-[#ec642f]">03 / the rules of the ring</div>
          </div>
          <div className="grid gap-3">
            {[
               [Shield, 'One lifetime NFT per wallet', 'The contract is designed to enforce one lifetime NFT per wallet. Optional X linking is a separate public social identity step. Mint availability is not live in this preview.'],
              [WalletCards, 'Robinhood Chain coins only', 'A fixed allowlist of eligible Robinhood Chain coins powers the mirror.'],
               [Flame, 'Capped coin contribution', 'Allowlisted coins count, but one meme pump cannot move the NFT through the entire ladder.'],
               [RotateCcw, 'Transfer means reset', 'Transfers are locked for seven days after mint or transfer. When the NFT moves, its snapshot and optional X link reset; the new owner starts fresh.'],
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
               <h2 className="display-face text-5xl font-bold leading-[.9] md:text-7xl">Preview<br /><span className="text-[#ec642f]">board only.</span></h2>
            </div>
               <p className="max-w-[330px] leading-relaxed text-[#aaa7a0]">Preview leaderboard</p>
          </div>
          <div className="mt-12 flex flex-col justify-between gap-4 border-y border-[#eee9dd]/15 py-4 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter leaderboard by stage">
              {(['all', ...stages.map((stage) => stage.key)] as const).map((filter) => (
                <button type="button" key={filter} onClick={() => setLeaderboardFilter(filter)} data-testid={`button-filter-${filter}`} className={`mono-face border px-3 py-2 text-[9px] transition-colors ${leaderboardFilter === filter ? 'border-[#f5bf58] bg-[#f5bf58] text-[#202534]' : 'border-[#eee9dd]/20 text-[#aaa7a0] hover:border-[#f5bf58] hover:text-[#f5bf58]'}`}>{filter === 'all' ? 'all NFTs' : stages.find((stage) => stage.key === filter)?.name}</button>
              ))}
            </div>
             <button type="button" onClick={() => setSortMode(sortMode === 'rank' ? 'growth' : 'rank')} data-testid="button-sort-leaderboard" className="mono-face flex items-center gap-2 text-[9px] text-[#f5bf58] hover:text-[#eee9dd]"><SlidersHorizontal className="h-3.5 w-3.5" /> sort: {sortMode === 'rank' ? 'global rank' : 'growth'} <ChevronDown className="h-3.5 w-3.5" /></button>
          </div>
           <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
             {visibleWarriors.map((warrior, index) => {
               const stage = stages.find((item) => item.key === warrior.stage) ?? stages[0];
               return (
                 <article key={warrior.name} data-testid={`row-leaderboard-${warrior.name}`} className="group border-2 border-[#eee9dd]/15 bg-[#272b3a] p-4 transition-colors hover:border-[#f5bf58] hover:bg-[#2b3042]">
                   <div className="flex items-start justify-between gap-3">
                     <div className={`font-mono text-sm ${index === 0 ? 'text-[#f5bf58]' : 'text-[#777985]'}`}>#{warrior.holderRank} <span className="text-[10px] text-[#777985]">/ {warrior.holderCount}</span></div>
                     <div className="mono-face border border-[#ec642f]/60 px-2 py-1 text-[8px] text-[#ec642f]">sample data</div>
                   </div>
                   <div className="mt-4 grid grid-cols-[112px_1fr] gap-4">
                     <div className="w-full"><WarriorIllustration stage={warrior.stage} /></div>
                     <div className="min-w-0">
                       <div className="truncate font-bold">{warrior.name}</div>
                       <div className="mt-1 font-mono text-[10px] text-[#777985]">{warrior.wallet}</div>
                       <div className="mt-5 flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />sample level: {stage.name}</div>
                       <div className="mt-4 border-t border-[#eee9dd]/15 pt-3">
                         <div className="mono-face text-[8px] text-[#777985]">sample growth window</div>
                         <div className="mt-1 font-mono text-xl text-[#4a8b68]">{formatGrowth(warrior.growthPct)}</div>
                       </div>
                     </div>
                   </div>
                   <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eee9dd]/15 pt-3 text-xs">
                     <span className="font-mono text-[#f5bf58]">{warrior.bag}</span>
                     <span className="text-[#aaa7a0]">transfer resets run</span>
                   </div>
                 </article>
               );
             })}
             {visibleWarriors.length === 0 && <div className="border-t border-[#eee9dd]/15 py-14 text-center text-[#aaa7a0]" data-testid="empty-leaderboard">No NFTs at this stage yet. The arena is still open.</div>}
          </div>
             <div className="mt-8 flex items-center gap-3 text-sm text-[#777985]"><Swords className="h-4 w-4 text-[#ec642f]" /> Illustrative challenge board: 247 preview rows. Live holder rankings are not enabled in this preview.</div>
        </div>
      </section>

      <section id="mint" className="mx-auto max-w-[1320px] scroll-mt-10 px-5 py-24 md:px-10 md:py-36" data-testid="section-mint">
        <div className="relative overflow-hidden border-2 border-[#202534] bg-[#f5bf58] p-7 md:p-14">
          <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full border-[30px] border-[#ec642f]/20" />
          <div className="absolute -bottom-28 right-24 h-72 w-72 rounded-full border border-[#202534]/15" />
           <div className="relative grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] xl:items-end">
             <div className="min-w-0">
              <div className="mono-face mb-5 text-[10px] text-[#ec642f]">05 / claim your mirror</div>
                <h2 className="display-face max-w-[750px] text-4xl font-bold leading-[.88] sm:text-5xl md:text-7xl xl:text-8xl">
                 <span className="block">Make your</span>
                 <span className="block">snapshot</span>
                 <span className="block text-[#ec642f]">visible.</span>
               </h2>
            </div>
             <div className="min-w-0">
               <p className="text-lg leading-relaxed text-[#4c4b51]">One wallet gets one NFT. Sign your wallet to request a future claim; linking X is optional but reduces your chance of being blocked for multiple accounts. No public mint is open in this preview.</p>
               <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => { void startWalletVerification(); }} disabled={identityBusy || identityKind !== null} data-testid="button-verify-wallet" className="button-cut bg-[#202534] px-6 py-4 font-bold text-[#eee9dd] transition-transform hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60">{identityKind === 'wallet' ? 'wallet control verified' : identityBusy && verificationIntent === 'wallet' ? 'checking wallet control…' : 'verify wallet control'} <ArrowUpRight className="ml-2 inline h-4 w-4 text-[#f5bf58]" /></button>
                  <button type="button" onClick={() => { void startIdentityVerification(); }} disabled={identityBusy || identityKind === 'x'} data-testid="button-join-signal" className="button-cut border-2 border-[#202534] px-6 py-4 font-bold text-[#202534] transition-transform hover:-translate-y-1 hover:bg-[#202534] hover:text-[#eee9dd] disabled:cursor-wait disabled:opacity-60">{identityKind === 'x' ? 'X linked' : identityBusy && verificationIntent === 'x' ? 'checking wallet for X link…' : 'link X (optional)'} <ArrowUpRight className="ml-2 inline h-4 w-4 text-[#202534]" /></button>
               </div>
              <div className="mt-5 border-l-2 border-[#202534] pl-4 text-sm leading-relaxed text-[#4c4b51]" aria-live="polite" data-testid="identity-status">
                 {identityState === 'idle' && <span>Prove you control a wallet with a plain signature. X linking is optional and only adds a public social identity. No approval, seed phrase, or custody.</span>}
                 {identityState === 'signing' && <span>Check your wallet. This plain signature proves wallet control only; it does not link X, grant permissions, or move coins.</span>}
                 {identityState === 'oauth' && <span>Wallet control was verified separately. Redirecting to X for optional account linking; X OAuth consent is a separate step.</span>}
                 {identityState === 'success' && <span className="font-bold">{identityKind === 'x' ? 'Wallet verified and optional X identity linked.' : 'Wallet verified. X linking is optional.'} Mint authorization is kept separate and remains closed until the official launch.</span>}
                 {identityState === 'unavailable' && <span>Wallet verification is not configured for this preview yet. No wallet or X verification flow was opened.</span>}
                {identityState === 'error' && <span><strong>{identityError === 'wallet_missing' ? 'A compatible wallet is needed.' : identityErrorCopy(identityError)}</strong> <button type="button" onClick={() => { void resetIdentityVerification(); }} className="ml-1 underline underline-offset-4" data-testid="button-retry-identity">try again</button></span>}
              </div>
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
              <h2 className="display-face text-3xl font-bold leading-none md:text-5xl">Know the risks.</h2>
              <p className="mt-5 text-base leading-relaxed md:text-lg">Stonkalicious is an experimental digital collectible and performance mirror, not financial advice, an investment, a security, or a promise of profit. Robinhood Chain coins are highly volatile. You may lose some or all of the money you spend, including 100% of your purchase.</p>
               <p className="mt-4 text-sm leading-relaxed opacity-80">This project has received an AI-assisted review for informational purposes only. It is not a formal independent smart-contract audit, does not guarantee contract or service safety, and does not replace qualified human security review. The collection is testnet-only while these checks are unfinished. Minting is not open in this preview; the contract, mutable metadata, and service may change or be unavailable.</p>
               <p className="mt-4 text-sm leading-relaxed opacity-80">To the fullest extent permitted by applicable law, Stonkalicious and its creators are not liable for losses, coin price moves, smart-contract bugs, wallet errors, outages, metadata delays, launch issues, or other damage connected with using or acquiring an NFT. Do your own research and only participate with money you can afford to lose. There is no surprise claim, airdrop, or DM: verify any future contract address or launch announcement on the official Stonkalicious domain.</p>
           </div>
         </div>
       </section>

      <footer className="bg-[#202534] px-5 py-8 text-[#aaa7a0] md:px-10">
        <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center border border-[#f5bf58]"><span className="h-3 w-3 rounded-full bg-[#ec642f]" /></div><span className="display-face text-lg text-[#eee9dd]">stonkalicious</span></div>
           <div className="mono-face text-[9px]">dynamic nft / robinhood chain / 2026</div>
           <div className="flex flex-wrap gap-5 text-sm"><a href="#rules" data-testid="link-footer-rules" className="hover:text-[#f5bf58]">rules</a><a href="#risk" data-testid="link-footer-risk" className="hover:text-[#f5bf58]">risk notice</a><a href="#mint" data-testid="link-footer-mint" className="hover:text-[#f5bf58]">mint</a><a href="#top" data-testid="link-footer-top" className="hover:text-[#f5bf58]">back to top ↑</a></div>
        </div>
          <div className="mx-auto mt-6 max-w-[1320px] border-t border-[#eee9dd]/15 pt-5 text-[10px] leading-relaxed text-[#777985]">Digital collectibles are high risk. No guarantee of value, liquidity, uptime, or future performance. AI-assisted review is informational only, not an independent audit, and does not replace qualified human security review. This notice is not a substitute for advice from a qualified lawyer or financial professional.</div>
      </footer>
    </main>
  );
}

export default App;