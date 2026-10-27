// react-pdf rendering shared by the PDF routes.
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { PUBLIC_DIR } from "./assets";

// react-pdf 4 keeps the loaded font object in a process-wide store and reusing it for the next document drops
// or garbles glyphs ("ARANTİ BELGESİ", "INIF"). Each render gets a freshly registered Roboto, and renders run
// one at a time so a re-registration never lands in the middle of another render. The store holds only the
// font files; document data reaches a render through its own element and comes back as its own buffer.
function registerRoboto() {
  delete (Font.getRegisteredFonts() as Record<string, unknown>).Roboto;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${PUBLIC_DIR}/fonts/Roboto-Regular.ttf` },
      { src: `${PUBLIC_DIR}/fonts/Roboto-Bold.ttf`, fontWeight: "bold" },
    ],
  });
}

Font.registerHyphenationCallback((word) => [word]);

const MAX_WAITING = 20;      // renders queued behind the running one; more are refused
const WAIT_MS = 60_000;      // longest a render waits for its turn
const RENDER_MS = 30_000;    // longest one render may hold the turn

/** Too many PDF renders queued, or one waited / ran too long. The routes answer 503. */
export class PdfBusyError extends Error {}

let busy = false;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (!busy) {
    busy = true;
    return Promise.resolve();
  }
  if (waiting.length >= MAX_WAITING) return Promise.reject(new PdfBusyError("PDF queue full"));
  return new Promise((resolve, reject) => {
    const turn = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      const i = waiting.indexOf(turn);
      if (i >= 0) waiting.splice(i, 1);
      reject(new PdfBusyError("PDF queue wait timed out"));
    }, WAIT_MS);
    waiting.push(turn);
  });
}

function release() {
  const next = waiting.shift();
  if (next) next(); // the turn passes straight on; busy stays true
  else busy = false;
}

export async function renderPdf(doc: Parameters<typeof renderToBuffer>[0]): Promise<Buffer> {
  await acquire();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    registerRoboto();
    // A render that times out keeps running in the background (react-pdf cannot be cancelled); its result is
    // dropped and the turn moves on, so one slow document cannot hold every other request.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PdfBusyError("PDF render timed out")), RENDER_MS);
    });
    return await Promise.race([renderToBuffer(doc), timeout]);
  } finally {
    clearTimeout(timer);
    release();
  }
}

/** Wraps a PDF route handler: a PdfBusyError becomes 503 with Retry-After, anything else is rethrown. */
export function withPdfBusy<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof PdfBusyError) {
        return new Response("PDF oluşturma şu anda yoğun, lütfen biraz sonra tekrar deneyin.", {
          status: 503,
          headers: { "Retry-After": "30" },
        });
      }
      throw e;
    }
  };
}
