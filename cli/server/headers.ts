/**
 * On every answer this server gives, not just on the page.
 *
 * They were on the static files alone, which is the half that matters least:
 * the JSON is where the run is — the task you typed, the plan, the note you
 * left at a gate — and it was the part going out with nothing on it. Together
 * they say: do not second-guess the content type, do not let anyone frame this,
 * and do not pass our address on as a referrer, which is what keeps a ticket
 * out of somebody else's logs.
 *
 * In a file of its own because both the routes and the event stream need them,
 * and reaching across for a constant is how two modules end up importing each
 * other.
 */
export const SAFE_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};
