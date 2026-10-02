import { accessibility, privacy, terms } from "../content/legal";
import LegalPage from "./LegalPage";

const DOCS = { privacy, terms, accessibility };

export default function Legal({ which }: { which: keyof typeof DOCS }) {
  return <LegalPage key={which} doc={DOCS[which]} />;
}
