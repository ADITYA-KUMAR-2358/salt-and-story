import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import RouteError from "./pages/RouteError";

// The landing page ships in the main bundle; task pages load on demand.
const Library = lazy(() => import("./pages/Library"));
const AddMemo = lazy(() => import("./pages/AddMemo"));
const RecipePage = lazy(() => import("./pages/RecipePage"));
const BookPage = lazy(() => import("./pages/BookPage"));
const Guide = lazy(() => import("./pages/Guide"));
const Credits = lazy(() => import("./pages/Credits"));
const Legal = lazy(() => import("./pages/Legal"));
const SignIn = lazy(() => import("./pages/SignIn"));
const Account = lazy(() => import("./pages/Account"));

function PageFallback() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-12 w-2/3 max-w-lg" />
      <div className="skeleton h-64" />
    </div>
  );
}

const page = (el: React.ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;
/** Pages that belong to an account: visitors are sent to sign in first. */
const mine = (el: React.ReactNode) => page(<RequireAuth>{el}</RequireAuth>);

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/recipes", element: mine(<Library />) },
      { path: "/recipes/:id", element: mine(<RecipePage />) },
      { path: "/add", element: mine(<AddMemo />) },
      { path: "/book", element: mine(<BookPage />) },
      { path: "/guide", element: page(<Guide />) },
      { path: "/credits", element: page(<Credits />) },
      { path: "/privacy", element: page(<Legal which="privacy" />) },
      { path: "/terms", element: page(<Legal which="terms" />) },
      { path: "/accessibility", element: page(<Legal which="accessibility" />) },
      { path: "/signin", element: page(<SignIn />) },
      { path: "/account", element: mine(<Account />) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
