import { useState } from "react";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Classes for the wrapper that holds the skeleton and sets the shape. */
  frame?: string;
  eager?: boolean;
};

/**
 * Every photo in the app: a shimmering skeleton holds the space until the image
 * has decoded, then it fades in. Lazy-loaded unless marked eager. A broken image
 * falls back to the gingham texture instead of the browser's broken icon.
 */
export default function Img({ frame = "", className = "", eager, alt = "", onLoad, onError, ...rest }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  return (
    <span className={`relative block overflow-hidden ${state === "loading" ? "skeleton" : ""} ${state === "error" ? "gingham" : ""} ${frame}`}>
      {state !== "error" && (
        <img
          {...rest}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={(e) => { setState("loaded"); onLoad?.(e); }}
          onError={(e) => { setState("error"); onError?.(e); }}
          className={`size-full object-cover transition-opacity duration-500 ease-out ${state === "loaded" ? "opacity-100" : "opacity-0"} ${className}`}
        />
      )}
    </span>
  );
}
