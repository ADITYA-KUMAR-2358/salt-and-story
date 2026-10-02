import { useGSAP } from "@gsap/react";
import { ArrowDown, BookOpenText, Lock, Plus, SpeakerHigh } from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookIllustration, CardIllustration, MicIllustration } from "../components/Brand";
import ClassicCard from "../components/ClassicCard";
import HeroStories, { type Story } from "../components/HeroStories";
import Img from "../components/Img";
import VoiceToRecipe from "../components/VoiceToRecipe";
import { CLASSICS, classicImage, type Region } from "../classics";
import { landing as c } from "../content/landing";
import { useTitle } from "../hooks";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEP_ART = [MicIllustration, CardIllustration, BookIllustration];

// Each hero story pairs a dish photo with a line its cook actually said (see /samples).
const byKey = (k: string) => CLASSICS.find((x) => x.key === k)!;
const STORIES: Story[] = [
  { img: "hero-hands", alt: c.hero.photoAlt, quote: "Everybody wants to rush the crust and you can't.", who: "Grandma Ruth", dish: "pie crust" },
  ...["ragu", "crepes", "biscuits", "apple-pie"].map((k) => {
    const x = byKey(k);
    return { img: k, alt: x.alt, quote: x.quote, who: x.speaker_name ?? "", dish: x.title.toLowerCase() };
  }),
];

export default function Landing() {
  useTitle("");
  const root = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<Region | "All">("All");
  const shown = CLASSICS.filter((x) => region === "All" || x.region === region);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // 1. The authored moment: hero comes together like a table being set.
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-line", { yPercent: 110, duration: 1.1, stagger: 0.09 })
        .from(".hero-photo", { clipPath: "inset(100% 0% 0% 0% round 16px)", duration: 1.3 }, 0.1)
        .from(".hero-card", { y: 50, opacity: 0, duration: 1 }, 0.6)
        .from(".hero-fade", { y: 16, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.45);

      // 2. Illustrations draw themselves as the steps scroll in (storytelling the sequence).
      gsap.utils.toArray<HTMLElement>(".how-step").forEach((step, i) => {
        const strokes = step.querySelectorAll<SVGGeometryElement>(".ill");
        strokes.forEach((s) => {
          const len = s.getTotalLength?.() ?? 200;
          gsap.set(s, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap.timeline({ scrollTrigger: { trigger: step, start: "top 82%", once: true } })
          .to(strokes, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", stagger: 0.06, delay: i * 0.12 })
          .from(step.querySelectorAll(".how-text"), { y: 18, opacity: 0, duration: 0.7, ease: "expo.out" }, "-=0.9");
      });

      // Photos "develop" as they scroll in, like prints laid on the kitchen table:
      // warm and faded and a little soft, then settling into full colour.
      ScrollTrigger.batch(".reveal-img", {
        start: "top 85%",
        once: true,
        onEnter: (batch) => {
          gsap.fromTo(batch, { y: 28, rotate: (i: number) => (i % 2 ? 1.6 : -1.6), opacity: 0 },
            { y: 0, rotate: 0, opacity: 1, duration: 1.1, ease: "power3.out", stagger: 0.15 });
          gsap.fromTo(batch.map((b) => b.querySelector("img")),
            { filter: "sepia(0.75) saturate(0.45) brightness(1.18) blur(3px)" },
            { filter: "sepia(0) saturate(1) brightness(1) blur(0px)", duration: 2.2, ease: "power2.out", stagger: 0.15, clearProps: "filter" });
        },
      });
      gsap.to(".bento-photo img", {
        yPercent: 8, scale: 1.08, ease: "none",
        scrollTrigger: { trigger: ".bento-photo", start: "top bottom", end: "bottom top", scrub: true },
      });

      // 3. The archive photo drifts slower than the page: a window into another time.
      gsap.fromTo(".story-img", { yPercent: -12 }, {
        yPercent: 12, ease: "none",
        scrollTrigger: { trigger: ".story-band", start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.from(".story-line", {
        opacity: 0, y: 30, duration: 1.2, ease: "expo.out",
        scrollTrigger: { trigger: ".story-band", start: "top 70%", once: true },
      });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="overflow-x-clip">
      {/* HERO */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pt-10 lg:pb-24">
        <div className="grid gap-7">
          <h1 className="font-display text-[clamp(2.7rem,6.2vw,5rem)] leading-[0.98] font-extrabold tracking-[-0.035em]">
            {c.hero.title.map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]"><span className="hero-line block">{line}</span></span>
            ))}
          </h1>
          <p className="hero-fade max-w-[34ch] text-xl leading-relaxed text-muted">{c.hero.lead}</p>
          <div className="hero-fade flex flex-wrap gap-3">
            <Link to="/add" className="btn btn-primary btn-lg"><Plus size={20} weight="bold" /> {c.hero.primary}</Link>
            <a href="#how" className="btn btn-lg"><ArrowDown size={18} /> {c.hero.secondary}</a>
          </div>
        </div>

        <HeroStories stories={STORIES} />
      </section>

      {/* DEMO */}
      <section aria-labelledby="demo-h" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-8 grid max-w-2xl gap-3">
          <h2 id="demo-h" className="font-display text-4xl font-extrabold md:text-5xl">{c.demo.title}</h2>
          <p className="text-lg text-muted">{c.demo.lead}</p>
        </div>
        <VoiceToRecipe />
      </section>

      {/* HOW IT WORKS: a real sequence, so it is numbered */}
      <section id="how" aria-labelledby="how-h" className="gingham-sage mt-16 scroll-mt-4 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="how-h" className="font-display text-4xl font-extrabold md:text-5xl">{c.how.title}</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {c.how.steps.map((s, i) => {
              const Art = STEP_ART[i];
              return (
                <li key={s.title} className="how-step lift grid content-start gap-4 rounded-[var(--r)] bg-surface p-7">
                  <div className="flex items-center justify-between">
                    <Art className="size-24 text-ink" />
                    <span className="font-display text-6xl font-extrabold text-[color-mix(in_srgb,var(--primary)_22%,transparent)]" aria-hidden="true">{i + 1}</span>
                  </div>
                  <div className="how-text grid gap-2">
                    <h3 className="font-display text-2xl font-bold">{s.title}</h3>
                    <p className="text-muted">{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <Link to="/guide" className="btn mt-8"><BookOpenText size={20} /> {c.how.cta}</Link>
        </div>
      </section>

      {/* FEATURES: bento, six cells for six ideas */}
      <section aria-labelledby="feat-h" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 id="feat-h" className="mb-10 max-w-2xl font-display text-4xl font-extrabold md:text-5xl">{c.features.title}</h2>
        <div className="grid gap-5 md:grid-cols-6">
          <div className="gingham relative grid min-h-72 content-end overflow-hidden rounded-[var(--r)] p-3 md:col-span-4">
            <div className="index-card lift max-w-xl px-6 pt-3 pb-6">
              <p className="flex h-8 items-center font-display font-bold">{c.features.voice.title}</p>
              <p className="font-hand mt-5 text-[2rem] leading-8">&ldquo;I still hear the pan sizzling when I think of my father at the stove in his undershirt.&rdquo;</p>
              <p className="mt-3 text-muted">{c.features.voice.body}</p>
            </div>
          </div>

          <div className="grid content-between gap-6 rounded-[var(--r)] border border-line bg-surface p-7 md:col-span-2">
            <div className="grid gap-1 rounded-xl bg-bg-2 p-4">
              <span className="text-muted line-through decoration-accent decoration-2">{c.features.honest.from}</span>
              <span className="font-semibold"><strong>{c.features.honest.to}</strong> <span className="text-muted">{c.features.honest.note}</span></span>
            </div>
            <div className="grid gap-2">
              <h3 className="font-display text-2xl font-bold">{c.features.honest.title}</h3>
              <p className="text-muted">{c.features.honest.body}</p>
            </div>
          </div>

          <div className="grid content-between gap-8 rounded-[var(--r)] bg-primary p-7 text-on-primary md:col-span-2">
            <div className="grid gap-3">
              <span className="font-display text-lg font-bold opacity-80">{c.features.cook.step}</span>
              <p className="font-display text-3xl leading-tight font-semibold">{c.features.cook.sample}</p>
            </div>
            <div className="grid gap-2">
              <h3 className="font-display text-2xl font-bold">{c.features.cook.title}</h3>
              <p className="opacity-85">{c.features.cook.body}</p>
            </div>
          </div>

          <div className="bento-photo reveal-img relative grid min-h-80 overflow-hidden rounded-[var(--r)] md:col-span-4">
            <Img src={classicImage("ragu", 1280)} alt={c.features.book.alt} frame="!absolute inset-0 size-full" className="origin-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(16_32_26/0.88)] via-[rgb(16_32_26/0.25)] to-transparent" />
            <div className="relative grid content-end gap-2 p-7 text-[#fffdf8]">
              <h3 className="font-display text-3xl font-bold">{c.features.book.title}</h3>
              <p className="max-w-md opacity-90">{c.features.book.body}</p>
            </div>
          </div>

          <div className="grid content-start gap-3 rounded-[var(--r)] border border-line bg-surface p-7 md:col-span-3">
            <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-ink"><SpeakerHigh size={24} weight="fill" /></span>
            <h3 className="font-display text-2xl font-bold">{c.features.listen.title}</h3>
            <p className="text-muted">{c.features.listen.body}</p>
          </div>
          <div className="grid content-start gap-3 rounded-[var(--r)] border border-line bg-surface p-7 md:col-span-3">
            <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-ink"><Lock size={24} weight="fill" /></span>
            <h3 className="font-display text-2xl font-bold">{c.features.open.title}</h3>
            <p className="text-muted">{c.features.open.body}</p>
          </div>
        </div>
      </section>

      {/* STORY BAND */}
      <section className="story-band relative isolate min-h-[34rem] overflow-hidden" aria-label="Why this exists">
        <img src="/images/chandeleur-1930s-1280.webp" alt={c.story.alt} loading="lazy"
          className="story-img absolute inset-0 -z-10 h-[124%] w-full -translate-y-[12%] object-cover grayscale-[20%] sepia-[25%]" />
        <div className="absolute inset-0 -z-10 bg-[rgb(16_32_26/0.62)]" />
        <div className="mx-auto grid min-h-[34rem] max-w-7xl content-center px-4 py-20 sm:px-6">
          <p className="story-line font-hand max-w-3xl text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.08] text-[#fffdf8]">{c.story.line}</p>
          <p className="mt-8 text-sm text-[#e8f0de]">{c.story.caption}</p>
        </div>
      </section>

      {/* CLASSICS */}
      <section id="classics" aria-labelledby="classics-h" className="mx-auto max-w-7xl scroll-mt-4 px-4 py-24 sm:px-6">
        <div className="grid gap-4 md:flex md:items-end md:justify-between">
          <div className="grid max-w-2xl gap-3">
            <h2 id="classics-h" className="font-display text-4xl font-extrabold md:text-5xl">{c.classics.title}</h2>
            <p className="text-lg text-muted">{c.classics.lead}</p>
          </div>
          <div role="group" aria-label={c.classics.filter} className="flex flex-wrap gap-2">
            {(["All", "American", "European"] as const).map((r) => (
              <button key={r} aria-pressed={region === r} onClick={() => setRegion(r)}
                className={`btn ${region === r ? "btn-primary" : ""}`}>
                {r === "All" ? c.classics.all : r}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10 grid items-start gap-6 md:grid-cols-2">
          {shown.map((x, i) => (
            <div key={x.key} className={i === 0 ? "md:col-span-2" : ""}>
              <ClassicCard c={x} size={i === 0 ? "wide" : "normal"} />
            </div>
          ))}
        </div>
      </section>

      {/* CLOSE */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="gingham rounded-[var(--r)] p-3">
          <div className="grid gap-6 rounded-[calc(var(--r)-4px)] bg-surface px-6 py-12 text-center sm:px-12">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold md:text-5xl">{c.close.title}</h2>
            <p className="mx-auto max-w-lg text-lg text-muted">{c.close.body}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/add" className="btn btn-primary btn-lg"><Plus size={20} weight="bold" /> {c.close.primary}</Link>
              <Link to="/guide" className="btn btn-lg"><BookOpenText size={20} /> {c.close.secondary}</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
