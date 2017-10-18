const assert = require('chai').assert
const SoapUtils = require('../src/soaputils')
const fs = require('fs')
const http = require('http')

describe('SOAPClient', function() {
  const sampleWSDL = fs.readFileSync(__dirname + '/../examples/StockQuote.wsdl')
  const httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/test1') {
      res.end(
        [
          '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:stoc="http://example.com/stockquote.xsd">',
          '    <soapenv:Header/>',
          '    <soapenv:Body>',
          '        <stoc:TradePrice>',
          '            <price>10</price>',
          '        </stoc:TradePrice>',
          '    </soapenv:Body>',
          '</soapenv:Envelope>'
        ].join('\n')
      )
    } else if (req.method === 'GET' && req.url === '/StockQuote.wsdl') {
      res.setHeader('Content-Type', 'application/soap+xml')
      res.end(sampleWSDL)
    } else {
      res.statusCode = 404
      res.end()
    }
  })

  let port = 0
  before(done => {
    httpServer.listen(0, () => {
      port = httpServer.address().port
      done()
    })
  })

  //"http://localhost:8088/mockStockQuoteSoapBinding"
  it('Create new client and class service', done => {
    const client = new SoapUtils(
      sampleWSDL,
      'http://localhost:' + port + '/test1'
    )
    let requestSample = client.generateSampleRequest(
      'StockQuoteService',
      'StockQuoteBinding',
      'GetLastTradePrice'
    )
    requestSample.TradePriceRequest.tickerSymbol = 'GOOG'
    client
      .sendRequest(
        'StockQuoteService',
        'StockQuoteBinding',
        'GetLastTradePrice',
        requestSample
      )
      .then(response => {
        assert.deepEqual(response, { TradePrice: { price: 10 } })
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('Create new client from url', done => {
    SoapUtils.fromUrl('http://localhost:' + port + '/StockQuote.wsdl')
      .then(soapUtils => {
        try {
          assert.isTrue(soapUtils instanceof SoapUtils)
          done()
        } catch (err) {
          done(err)
        }
      })
      .catch(function(err) {
        console.log(err)
        done(err)
      })
  })
})
