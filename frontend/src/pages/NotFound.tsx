import { Link } from "react-router-dom";
import { EmptyPotIllustration } from "../components/Brand";
import { useTitle } from "../hooks";
import { t } from "../strings";

export default function NotFound() {
  useTitle("Page not found");
  return (
    <section className="mx-auto grid max-w-3xl place-items-center gap-6 px-4 py-20 text-center">
      <EmptyPotIllustration className="size-48 text-ink" title="An empty pot with its lid lifted" />
      <p className="font-display text-7xl font-extrabold text-primary">404</p>
      <h1 className="font-display text-4xl font-extrabold md:text-5xl">{t.notFound.title}</h1>
      <p className="max-w-md text-lg text-muted">{t.notFound.body}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary btn-lg">{t.notFound.home}</Link>
        <Link to="/recipes" className="btn btn-lg">{t.notFound.recipes}</Link>
      </div>
    </section>
  );
}
