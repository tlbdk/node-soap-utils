/*eslint-env node, mocha */

const assert = require("chai").assert;
const SoapUtils = require("../src/soaputils");
const fs = require("fs");

describe("Generate sample Request/Response json/xml", () => {
    let wsdl_sample = fs.readFileSync(__dirname + "/../examples/StockQuote.wsdl", 'utf8');

    it("getServices", () => {
        let expectedServices = {
            StockQuoteService: {
                StockQuoteBinding: {
                    GetLastTradePrice: {
                        action: "http://example.com/GetLastTradePrice",
                        input: "xsd1:TradePriceRequest",
                        output: "xsd1:TradePrice"
                    }
                }
            }
        };
        let soapUtils = new SoapUtils(wsdl_sample);
        let services = soapUtils.getServices();
        assert.deepEqual(services, expectedServices);
    });

    it("generateSampleRequest", () => {
        let expectedRequest = {
            TradePriceRequest: {
                tickerSymbol: " "
            }
        };
        let soapUtils = new SoapUtils(wsdl_sample);
        let generatedRequest = soapUtils.generateSampleRequest("StockQuoteService", "StockQuoteBinding", "GetLastTradePrice");
        assert.deepEqual(generatedRequest, expectedRequest);
    });

    it("generateSampleResponse", () => {
        let expectedResponse = {
            TradePrice: {
                price: 0
            }
        };
        let soapUtils = new SoapUtils(wsdl_sample);
        let generatedResponse = soapUtils.generateSampleResponse("StockQuoteService", "StockQuoteBinding", "GetLastTradePrice");
        assert.deepEqual(generatedResponse, expectedResponse);
    });

    it("generateRequest", () => {
        let request = {
            TradePriceRequest: {
                tickerSymbol: "GOOG"
            }
        };

        let expectedRequest = [
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
            '  <soap:Header />',
            '  <soap:Body>',
            '    <xsd1:TradePriceRequest xmlns:xsd1="http://example.com/stockquote.xsd">',
            '      <tickerSymbol>GOOG</tickerSymbol>',
            '    </xsd1:TradePriceRequest>',
            '  </soap:Body>',
            '</soap:Envelope>'
        ].join("\n");

        let soapUtils = new SoapUtils(wsdl_sample);
        let generatedRequest = soapUtils.generateSoapMessage(request);
        assert.equal(generatedRequest, expectedRequest);
    });

    it("generateResponse", () => {
        let response = {
            TradePrice: {
                price: 10
            }
        };

        let expectedResponse = [
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
            '  <soap:Header />',
            '  <soap:Body>',
            '    <xsd1:TradePrice xmlns:xsd1="http://example.com/stockquote.xsd">',
            '      <price>10</price>',
            '    </xsd1:TradePrice>',
            '  </soap:Body>',
            '</soap:Envelope>'
        ].join("\n");

        let soapUtils = new SoapUtils(wsdl_sample);
        let generatedResponse = soapUtils.generateSoapMessage(response);
        assert.equal(generatedResponse, expectedResponse);
    });
});