import { OG_IMAGE, pageMetadata, SHARED_OPEN_GRAPH, SHARED_TWITTER } from "../metadata";

describe("pageMetadata", () => {
  const meta = pageMetadata({ title: "Boiler lifespan", description: "How long a boiler lasts.", path: "/lifespan/boiler" });

  it("keeps the shared image, site name and type in the page's own Open Graph", () => {
    expect(meta.openGraph).toEqual({
      siteName: "CapexClock",
      type: "website",
      images: [OG_IMAGE],
      title: "Boiler lifespan",
      description: "How long a boiler lasts.",
      url: "/lifespan/boiler",
    });
  });

  it("gives the Twitter card the page's own title, description and image", () => {
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      images: [OG_IMAGE],
      title: "Boiler lifespan",
      description: "How long a boiler lasts.",
    });
    expect(meta.alternates).toEqual({ canonical: "/lifespan/boiler" });
  });

  it("leaves titles, descriptions and URLs out of the site-wide defaults", () => {
    for (const shared of [SHARED_OPEN_GRAPH, SHARED_TWITTER]) {
      for (const key of ["title", "description", "url"]) expect(shared).not.toHaveProperty(key);
    }
  });
});
