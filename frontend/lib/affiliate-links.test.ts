describe("affiliate-links", () => {
  const originalAmazonTag = process.env.EXPO_PUBLIC_AMAZON_AFFILIATE_TAG;
  const originalWalmartTemplate = process.env.EXPO_PUBLIC_WALMART_AFFILIATE_URL_TEMPLATE;

  afterEach(() => {
    process.env.EXPO_PUBLIC_AMAZON_AFFILIATE_TAG = originalAmazonTag;
    process.env.EXPO_PUBLIC_WALMART_AFFILIATE_URL_TEMPLATE = originalWalmartTemplate;
  });

  function loadModule() {
    let mod: typeof import("./affiliate-links");
    jest.isolateModules(() => {
      mod = require("./affiliate-links");
    });
    return mod!;
  }

  describe("buildAmazonSearchUrl", () => {
    it("returns a plain search URL when no affiliate tag is set", () => {
      delete process.env.EXPO_PUBLIC_AMAZON_AFFILIATE_TAG;
      const { buildAmazonSearchUrl } = loadModule();

      const url = buildAmazonSearchUrl("creatine monohydrate");

      expect(url).toBe("https://www.amazon.com/s?k=creatine+monohydrate");
    });

    it("appends the tag param when an affiliate tag is set", () => {
      process.env.EXPO_PUBLIC_AMAZON_AFFILIATE_TAG = "activeai-20";
      const { buildAmazonSearchUrl } = loadModule();

      const url = buildAmazonSearchUrl("whey protein");

      expect(url).toBe("https://www.amazon.com/s?k=whey+protein&tag=activeai-20");
    });
  });

  describe("buildWalmartSearchUrl", () => {
    it("returns a plain search URL when no affiliate template is set", () => {
      delete process.env.EXPO_PUBLIC_WALMART_AFFILIATE_URL_TEMPLATE;
      const { buildWalmartSearchUrl } = loadModule();

      const url = buildWalmartSearchUrl("multivitamin");

      expect(url).toBe("https://www.walmart.com/search?q=multivitamin");
    });

    it("wraps the destination URL in the affiliate template when set", () => {
      process.env.EXPO_PUBLIC_WALMART_AFFILIATE_URL_TEMPLATE = "https://goto.walmart.com/c/12345/{URL}";
      const { buildWalmartSearchUrl } = loadModule();

      const url = buildWalmartSearchUrl("multivitamin");

      const expectedInner = encodeURIComponent("https://www.walmart.com/search?q=multivitamin");
      expect(url).toBe(`https://goto.walmart.com/c/12345/${expectedInner}`);
    });
  });
});
