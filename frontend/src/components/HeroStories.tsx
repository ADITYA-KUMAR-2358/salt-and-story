import { useGSAP } from "@gsap/react";
import { HandTap, Quotes } from "@phosphor-icons/react";
import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks";

export interface Story { img: string; alt: string; quote: string; who: string; dish: string }

const AUTOPLAY_MS = 7000;
const SWIPE_PX = 60;
const src = (img: string, w: 640 | 1280) => `/images/${img}-${w}.webp`;

type Pose = { x: number; y: number; rotate: number; scale: number; autoAlpha: number };
/** Where a photo sits in the deck: 0 is the top print, higher numbers sit further back. */
function photoPose(pos: number, fanned: boolean): Pose {
  const f = fanned ? 1.9 : 1;
  const p = Math.min(pos, 3);
  return { x: p * 15 * f, y: -p * 11 * f, rotate: p * 3.4 * f, scale: 1 - p * 0.035, autoAlpha: pos > 2 ? 0 : 1 };
}
/** Where a quote card sits in its own deck. */
function cardPose(pos: number): Pose {
  const p = Math.min(pos, 3);
  return { x: p * 9, y: p * 9, rotate: -2 + p * 2.6, scale: 1 - p * 0.02, autoAlpha: pos > 2 ? 0 : 1 };
}

/**
 * The hero: a deck of photographs and a deck of handwritten cards, first in, first out.
 * Advancing sends the top print (and its card) off the deck and tucks it in at the back;
 * everything else steps forward one place. Going back pulls the last one to the front.
 *
 * Mouse: hovering fans the deck and tilts the top print toward the pointer.
 * Touch: the top print follows your finger; let go past a threshold to advance.
 * Keyboard: arrow keys once the carousel has focus, and the dots. Reduced motion: no animation, no autoplay.
 */
export default function HeroStories({ stories }: { stories: Story[] }) {
  const n = stories.length;
  const root = useRef<HTMLDivElement>(null);
  const photos = useRef<(HTMLDivElement | null)[]>([]);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [top, setTop] = useState(0);
  const topRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const busy = useRef(false);
  const fanned = useRef(false);
  const kenBurns = useRef<gsap.core.Tween | null>(null);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const reduce = usePrefersReducedMotion();
  const { contextSafe } = useGSAP({ scope: root });
  const pos = (i: number, t = topRef.current) => (i - t + n) % n;

  /** Snap (or glide) every item to its slot for the current top. */
  const layout = useCallback((duration = 0) => {
    photos.current.forEach((el, i) => {
      if (!el) return;
      const p = pos(i);
      gsap.to(el, { ...photoPose(p, fanned.current), zIndex: n - p, duration, ease: "expo.out", overwrite: "auto" });
    });
    cards.current.forEach((el, i) => {
      if (!el) return;
      const p = pos(i);
      gsap.to(el, { ...cardPose(p), zIndex: n - p, duration, ease: "expo.out", overwrite: "auto" });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const startKenBurns = useCallback(() => {
    kenBurns.current?.kill();
    const img = photos.current[topRef.current]?.querySelector("img");
    if (!img || reduce) return;
    kenBurns.current = gsap.fromTo(img, { scale: 1.03 }, { scale: 1.12, duration: AUTOPLAY_MS / 1000 + 2, ease: "none" });
  }, [reduce]);

  useLayoutEffect(() => { layout(0); startKenBurns(); return () => { kenBurns.current?.kill(); }; }, [layout, startKenBurns]);

  /** One FIFO step. dir 1: top goes to the back. dir -1: the back comes to the top. */
  const step = contextSafe((dir: 1 | -1, speed = 1) => new Promise<void>((resolve) => {
    const from = topRef.current;
    const to = (from + dir + n) % n;
    if (reduce) { topRef.current = to; setTop(to); layout(0); resolve(); return; }
    const movingPhoto = photos.current[dir === 1 ? from : to];
    const movingCard = cards.current[dir === 1 ? from : to];
    const w = movingPhoto?.offsetWidth ?? 400;
    // A hover fan or tilt may still be animating the deck; it would overwrite the new order.
    gsap.killTweensOf([...photos.current, ...cards.current].filter(Boolean) as Element[]);
    const tl = gsap.timeline({ onComplete: () => { startKenBurns(); resolve(); } }).timeScale(speed);
    kenBurns.current?.kill();

    if (dir === 1) {
      // 1. the top print and card slide off the deck
      tl.to(movingPhoto, { x: w * 0.78, y: -26, rotate: 13, duration: 0.42, ease: "power2.in" }, 0)
        .to(movingCard, { x: -w * 0.5, y: 14, rotate: -10, duration: 0.42, ease: "power2.in" }, 0)
        // 2. drop them under the deck: they are now last in line
        .add(() => {
          topRef.current = to;
          setTop(to);
          gsap.set(movingPhoto, { zIndex: 0 });
          gsap.set(movingCard, { zIndex: 0 });
        })
        // 3. tuck them in at the back while everyone else steps forward
        .to(movingPhoto, { ...photoPose(n - 1, fanned.current), autoAlpha: n > 3 ? 0 : 1, duration: 0.6, ease: "expo.out" })
        .to(movingCard, { ...cardPose(n - 1), duration: 0.6, ease: "expo.out" }, "<");
      photos.current.forEach((el, i) => {
        if (!el || i === from) return;
        tl.to(el, { ...photoPose(pos(i, to), fanned.current), zIndex: n - pos(i, to), duration: 0.7, ease: "expo.out" }, 0.18 + pos(i, to) * 0.05);
      });
      cards.current.forEach((el, i) => {
        if (!el || i === from) return;
        tl.to(el, { ...cardPose(pos(i, to)), zIndex: n - pos(i, to), duration: 0.7, ease: "back.out(1.4)" }, 0.22 + pos(i, to) * 0.05);
      });
    } else {
      // the last print slides out from behind the deck and lands on top
      gsap.set(movingPhoto, { autoAlpha: 1 });
      gsap.set(movingCard, { autoAlpha: 1 });
      tl.to(movingPhoto, { x: w * 0.78, y: -26, rotate: 13, duration: 0.42, ease: "power2.out" }, 0)
        .to(movingCard, { x: -w * 0.5, y: 14, rotate: -10, duration: 0.42, ease: "power2.out" }, 0)
        .add(() => {
          topRef.current = to;
          setTop(to);
          gsap.set(movingPhoto, { zIndex: n + 1 });
          gsap.set(movingCard, { zIndex: n + 1 });
        })
        .to(movingPhoto, { ...photoPose(0, fanned.current), duration: 0.6, ease: "expo.out" })
        .to(movingCard, { ...cardPose(0), duration: 0.6, ease: "back.out(1.4)" }, "<");
      photos.current.forEach((el, i) => {
        if (!el || i === to) return;
        tl.to(el, { ...photoPose(pos(i, to), fanned.current), zIndex: n - pos(i, to), duration: 0.6, ease: "expo.out" }, 0.1);
      });
      cards.current.forEach((el, i) => {
        if (!el || i === to) return;
        tl.to(el, { ...cardPose(pos(i, to)), zIndex: n - pos(i, to), duration: 0.6, ease: "expo.out" }, 0.1);
      });
    }
  }));

  const go = useCallback(async (dir: 1 | -1, manual = true) => {
    if (busy.current) return;
    busy.current = true;
    if (manual) setAnnounce(true);
    await step(dir);
    busy.current = false;
  }, [step]);

  /** Dots: step through the deck quickly until the chosen story is on top. */
  const goTo = useCallback(async (target: number) => {
    if (busy.current || target === topRef.current) return;
    busy.current = true;
    setAnnounce(true);
    const forward = (target - topRef.current + n) % n;
    const back = n - forward;
    const dir: 1 | -1 = forward <= back ? 1 : -1;
    for (let k = 0; k < Math.min(forward, back); k++) await step(dir, 2.4);
    busy.current = false;
  }, [n, step]);

  // Autoplay, gently.
  useLayoutEffect(() => {
    if (reduce || paused) return;
    const id = window.setTimeout(() => { if (!document.hidden) go(1, false); }, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [top, paused, reduce, go]);

  // ---- pointer: fan + tilt on mouse hover, finger-follow on touch
  const topPhoto = () => photos.current[topRef.current];
  const fan = (on: boolean) => { if (reduce || fanned.current === on) return; fanned.current = on; if (!busy.current) layout(0.7); };
  const onEnter = (e: React.PointerEvent) => { setPaused(true); if (e.pointerType === "mouse") fan(true); };
  const onLeave = (e: React.PointerEvent) => {
    setPaused(false);
    if (e.pointerType !== "mouse" || reduce) return;
    fan(false);
    const el = topPhoto();
    if (el) gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "expo.out" });
  };
  const onMove = (e: React.PointerEvent) => {
    const el = topPhoto();
    if (reduce || !el || busy.current) return;
    if (e.pointerType === "mouse") {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotateY: px * 10, rotateX: -py * 10, duration: 0.6, ease: "power3.out" });
      return;
    }
    if (!drag.current) return;
    drag.current.dx = e.clientX - drag.current.x;
    gsap.to(el, { x: drag.current.dx * 0.6, rotate: drag.current.dx * 0.03, duration: 0.2, ease: "power3.out" });
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || busy.current) return;
    drag.current = { x: e.clientX, dx: 0 };
    setPaused(true);
    fan(true);
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !drag.current) return;
    const dx = drag.current.dx;
    drag.current = null;
    fan(false);
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
    else if (!reduce) { const el = topPhoto(); if (el) gsap.to(el, { ...photoPose(0, false), duration: 0.9, ease: "elastic.out(1, 0.55)" }); }
    window.setTimeout(() => setPaused(false), 1500);
  };

  const s = stories[top];

  return (
    <div ref={root} className="relative mx-auto w-full max-w-xl select-none"
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
      role="region" aria-roledescription="carousel" aria-label="Family recipe stories">

      {/* the photo deck */}
      <div className="relative aspect-[4/5] [perspective:1200px] sm:aspect-square"
        onPointerEnter={onEnter} onPointerLeave={onLeave} onPointerMove={onMove}
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: "pan-y" }}>
        {stories.map((st, i) => (
          <div key={st.img} ref={(el) => { photos.current[i] = el; }} aria-hidden={i !== top}
            className={`absolute inset-0 overflow-hidden rounded-[var(--r)] border-[6px] border-surface bg-bg-2 shadow-[0_22px_44px_-20px_rgb(var(--shadow)/0.55)] will-change-transform [transform-style:preserve-3d] ${i === top ? "hero-photo" : ""}`}>
            <img src={src(st.img, 1280)} srcSet={`${src(st.img, 640)} 640w, ${src(st.img, 1280)} 1280w`}
              sizes="(min-width: 1024px) 560px, 92vw" alt={st.alt} draggable={false}
              loading={i < 3 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "low"} decoding="async"
              className="size-full object-cover" />
          </div>
        ))}
      </div>

      {/* the card deck: every card shares one grid cell, so the deck is as tall as its tallest card */}
      <div className="hero-card relative z-[70] mx-3 -mt-14 grid sm:mx-0 sm:-mt-20 sm:ml-[-1rem] sm:w-[80%] lg:absolute lg:bottom-6 lg:-left-12 lg:mt-0 lg:w-[66%]">
        {stories.map((st, i) => (
          <button key={st.img} ref={(el) => { cards.current[i] = el; }} type="button" tabIndex={i === top ? 0 : -1}
            aria-hidden={i !== top} onClick={() => go(1)}
            aria-label={`${st.who}, ${st.dish}: “${st.quote}”. Show another`}
            className="index-card lift [grid-area:1/1] block cursor-pointer px-5 pt-3 pb-5 text-left will-change-transform">
            <span className="flex h-8 items-center justify-between gap-2 text-sm font-semibold text-muted">
              <span className="truncate">{st.who}, {st.dish}</span>
              <Quotes size={18} weight="fill" className="shrink-0 text-accent" aria-hidden />
            </span>
            <span className="font-hand mt-4 block text-[clamp(1.45rem,2.6vw,1.75rem)] leading-8">&ldquo;{st.quote}&rdquo;</span>
            <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary" aria-hidden="true">
              <HandTap size={14} weight="bold" /> Tap for another story
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex justify-center gap-1 lg:mt-6 lg:justify-end" role="group" aria-label="Choose a story">
        {stories.map((st, i) => (
          <button key={st.img} type="button" onClick={() => goTo(i)} aria-label={`Story ${i + 1} of ${n}: ${st.who}`} aria-current={i === top}
            className="grid h-11 w-8 place-items-center">
            <span className={`block h-2 rounded-full transition-all duration-500 ${i === top ? "w-7 bg-primary" : "w-2 bg-line hover:bg-muted"}`} />
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{announce ? `${s.who}: ${s.quote}` : ""}</p>
    </div>
  );
}
