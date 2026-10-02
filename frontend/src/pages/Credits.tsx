import Img from "../components/Img";
import { useTitle } from "../hooks";
import { t } from "../strings";

const PHOTOS = [
  { img: "hero-hands", title: "Baker woman's hands kneading bread dough", author: "Shixart1985", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Baker_woman%27s_hands_kneading_bread_dough.jpg" },
  { img: "apple-pie", title: "Lattice apple pie", author: "The-Wuje", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Lattice_apple_pie.png" },
  { img: "chicken-dumplings", title: "Chicken and dumplings", author: "Jonathunder", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:ChickenDumplings.jpg" },
  { img: "biscuits", title: "Buttermilk biscuits", author: "jeffreyw", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Buttermilk_biscuits_(6340812760).jpg" },
  { img: "ragu", title: "Tagliatelle al ragù, Trattoria Tony", author: "Alex Sirac", license: "CC BY 4.0", url: "https://commons.wikimedia.org/wiki/File:Tagliatelle_al_rag%C3%B9_Trattoria_Tony.jpg" },
  { img: "crepes", title: "Chandeleur, making crêpes (1934)", author: "Agence Rol", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:2-2-34,_Chandeleur_(fabrication_de_cr%C3%AApes)_-_btv1b532912784.jpg" },
  { img: "kartoffelsalat", title: "Schwäbischer Kartoffelsalat", author: "Dr. Bernd Gross", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Schw%C3%A4bischer_Kartoffelsalat_2.JPG" },
  { img: "chandeleur-1930s", title: "La Chandeleur, children eating crêpes", author: "Agence Mondial Photo-Presse", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:La_Chandeleur_-_gosses_mangeant_des_cr%C3%AApes_-_btv1b9034624v.jpg" },
];

export default function Credits() {
  useTitle(t.credits.title);
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">{t.credits.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">{t.credits.lead}</p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2">
        {PHOTOS.map((p) => (
          <li key={p.img} className="grid grid-cols-[6rem_1fr] items-center gap-4">
            <Img src={`/images/${p.img}-640.webp`} alt="" frame="aspect-square w-24 rounded-[var(--r)]" />
            <div className="grid gap-0.5">
              <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-primary hover:underline">{p.title}</a>
              <span className="text-sm text-muted">{p.author}</span>
              <span className="chip w-fit">{p.license}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-muted">{t.credits.made}</p>
    </section>
  );
}
