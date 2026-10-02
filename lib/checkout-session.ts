// Which payment reference (if any) an open in-app checkout screen
// (app/payment-initialize.tsx) is currently waiting on.
//
// When the provider finishes, it redirects to the app's own link. The
// in-app browser sheet catches that redirect and hands the result back to
// the checkout screen — but Android ALSO delivers it as an ordinary deep
// link, which opens app/payment-callback.tsx on top. That screen uses this
// to tell the two cases apart: if the checkout screen underneath owns this
// exact reference, it steps back and lets that screen finish; otherwise
// (app cold-started from the link, or a web page load) it verifies the
// payment itself.
let ownedReference: string | null = null;

export const CheckoutSession = {
  claim(reference: string): void {
    ownedReference = reference;
  },
  release(reference: string): void {
    if (ownedReference === reference) ownedReference = null;
  },
  owns(reference: string): boolean {
    return !!reference && ownedReference === reference;
  },
};
