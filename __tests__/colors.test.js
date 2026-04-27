const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadAppWithMocks(options = {}) {
  const codePath = path.join(__dirname, "..", "colors-lamp", "public", "js", "code.js");
  const code = fs.readFileSync(codePath, "utf8");

  const elements = {
    colorText: { value: "", innerHTML: "" },
    colorAddResult: { value: "", innerHTML: "" },
    firstParagraph: { value: "", innerHTML: "" },
    ...options.documentElements,
  };

  const document = {
    cookie: "",
    getElementById: jest.fn((id) => {
      if (!elements[id]) {
        elements[id] = { value: "", innerHTML: "" };
      }
      return elements[id];
    }),
    getElementsByTagName: jest.fn((tagName) => {
      if (tagName === "p") {
        return [elements.firstParagraph];
      }
      return [];
    }),
  };

  const sentRequests = [];

  function MockXMLHttpRequest() {
    this.headers = {};
    this.readyState = 0;
    this.status = 0;
    this.responseText = "";
  }

  MockXMLHttpRequest.prototype.open = function (method, url, async) {
    this.method = method;
    this.url = url;
    this.async = async;
  };

  MockXMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    this.headers[header] = value;
  };

  MockXMLHttpRequest.prototype.send = function (payload) {
    this.payload = payload;
    sentRequests.push(this);

    this.readyState = 4;
    this.status = 200;
    this.responseText = JSON.stringify(options.xhrResponse || { results: [] });

    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
  };

  const window = {
    location: {
      href: "",
    },
  };

  const context = {
    console,
    document,
    window,
    XMLHttpRequest: MockXMLHttpRequest,
    JSON,
    Date,
    parseInt,
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  return {
    window,
    document,
    elements,
    sentRequests,
  };
}

describe("Colors web app frontend behavior", () => {
  test("unit: doLogout clears the login cookie and redirects to index.html", () => {
    const { window, document } = loadAppWithMocks();

    window.doLogout();

    expect(document.cookie).toContain("firstName=");
    expect(window.location.href).toBe("index.html");
  });

  test("integration: addColor sends the color to the API and shows a success message", () => {
    const { window, elements, sentRequests } = loadAppWithMocks({
      documentElements: {
        colorText: { value: "Blue", innerHTML: "" },
        colorAddResult: { value: "", innerHTML: "" },
      },
    });

    window.addColor();

    expect(sentRequests).toHaveLength(1);
    expect(sentRequests[0].method).toBe("POST");
    expect(sentRequests[0].url).toBe("http://COP4331-5.com/LAMPAPI/AddColor.php");
    expect(JSON.parse(sentRequests[0].payload)).toEqual({
      color: "Blue",
      userId: 0,
    });
    expect(elements.colorAddResult.innerHTML).toBe("Color has been added");
  });
});