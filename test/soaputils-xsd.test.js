/*eslint-env node, mocha */

const assert = require("chai").assert;
const SoapUtils = require("../src/soaputils");
const xmlExact = require("xml-exact");
const fs = require("fs");
const xsd = require("libxml-xsd");

describe("Generate sample Request/Response json/xml", () => {
    let wsdlSample = fs.readFileSync(__dirname + "/../examples/StockQuote.wsdl", "utf8");
    let xsdEnvelope = fs.readFileSync(__dirname + "/../examples/soap-envelope.xsd", "utf8");

    it.skip("extract XSD and validate request", () => {
        let soapUtils = new SoapUtils(wsdlSample);

        let xsdEnvelopeObj = xmlExact.fromXml(xsdEnvelope, null, { inlineAttributes: true });

        console.log(JSON.stringify(xsdEnvelopeObj, null, 2));

        let sampleObj = {
            TradePriceRequest: {
                tickerSymbol: "GOOG"
            }
        };

        let sampleXml = soapUtils.generateSoapMessage(sampleObj);

        // Validate schema against generated XML
        let xsdSchema = soapUtils.getXsdSchema(); // TODO: Merge with xsdEnvelopeObj so we can validate a full soap message
        let schema = xsd.parse(xsdSchema);
        let validationErrors = schema.validate(sampleXml);
        assert.equal(null, validationErrors);
    });
});