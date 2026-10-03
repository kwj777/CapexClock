import { STORAGE_KEY } from "../draft-storage";
import { DRAFT_STORAGE_KEY } from "../storage-key";

describe("where the draft is kept", () => {
  it("is the key the loader reads to size its placeholder", () => {
    expect(STORAGE_KEY).toBe(DRAFT_STORAGE_KEY);
  });
});
