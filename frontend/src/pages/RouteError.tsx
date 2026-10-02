import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { BoiledOverIllustration, LogoMark } from "../components/Brand";
import { t } from "../strings";
import NotFound from "./NotFound";

/**
 * Catches anything that throws while rendering a route. Rendered outside the
 * normal layout (the layout itself may be what broke), so it brings its own frame.
 */
export default function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  const detail = error instanceof Error ? error.message : String(error);
  // A new deploy can leave an open tab asking for old code chunks: reload fixes it.
  const staleChunk = /dynamically imported module|Importing a module script failed/i.test(detail);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="gingham h-3" aria-hidden="true" />
      <a href="/" className="mx-auto mt-6 flex items-center gap-2.5">
        <LogoMark size={36} /><span className="font-display text-lg font-extrabold">{t.appName}</span>
      </a>
      <main className="mx-auto grid max-w-2xl flex-1 content-center place-items-center gap-6 px-4 py-16 text-center">
        <BoiledOverIllustration className="size-44 text-ink" title="A pot boiling over" />
        <h1 className="font-display text-4xl font-extrabold md:text-5xl">{t.error.title}</h1>
        <p className="max-w-md text-lg text-muted">{staleChunk ? "A newer version of Salt & Story is available. Reload to get it." : t.error.body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>{t.error.reload}</button>
          <a href="/" className="btn btn-lg">{t.error.home}</a>
        </div>
        {!staleChunk && (
          <details className="w-full max-w-lg text-left text-sm text-muted">
            <summary className="cursor-pointer font-semibold">{t.error.details}</summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-bg-2 p-3 whitespace-pre-wrap">{detail}</pre>
          </details>
        )}
      </main>
    </div>
  );
}
