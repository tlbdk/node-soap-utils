'use strict'

// SPNEGO linux: https://gist.github.com/dmansfield/c75817dcacc2393da0a7

let urlParser = require('url')
let http = require('http')
let xmlExact = require('xmlexact')

const wsdlDefinition = {
  definitions: {
    types: {
      schema$type: [],
      schema: {
        element$type: [],
        simpleType$type: [],
        complexType$type: []
      }
    },
    message$type: [],
    message: {
      part$type: []
    },
    portType$type: [],
    portType: {
      operation$type: [],
      fault$type: []
    },
    binding$type: [],
    binding: {
      operation$type: []
    },
    service$type: [],
    service: {
      port$type: []
    }
  }
}

class SoapUtils {
  constructor(wsdlString, url) {
    this._endpoint = url
    this._soapDefinition = {
      Envelope$namespace: 'soap',
      Envelope$attributes: {
        'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/'
      },
      Envelope$order: ['Header', 'Body'],
      Envelope: {
        Header$namespace: 'soap',
        Body$namespace: 'soap'
      }
    }

    // Parse WSDL in inline format
    const wsdlObj = xmlExact.fromXml(wsdlString, wsdlDefinition, {
      inlineAttributes: true
    })

    // Get namespaces from top level xml elements and generate xsd definition for this WSDL
    let namespaces = {}
    ;[wsdlObj.definitions, wsdlObj.definitions.types].forEach(obj => {
      Object.keys(obj).forEach(function(key) {
        let ns = key.match(/^\$(xmlns:.+)$/)
        if (ns) {
          namespaces[ns[1]] = obj[key]
        }
      })
    })

    // Inject XSD schema definition body so we can decode a SOAP message directly
    this._soapDefinition.Envelope.Body = xmlExact.generateDefinition(
      wsdlObj.definitions.types.schema[0],
      'xsd',
      namespaces
    ) // TODO: Support more than one schema

    // Extract services in the following format: { serviceName: { binding: { operation: { input: "ns:messageName", output: "ns:messageName" )
    this._services = _extractServices(wsdlObj.definitions)

    // Generate XSD Schema XML
    let schemaObj = {
      schema: wsdlObj.definitions.types.schema[0]
    }
    this._xsdSchema = xmlExact.toXml(
      schemaObj,
      'schema',
      { schema$attributes: namespaces },
      { convertTypes: false }
    )
  }

  static fromUrl(wsdlUrl) {
    return _httpGetString(wsdlUrl).then(wsdlString => {
      return new SoapUtils(wsdlString)
    })
  }

  // { type:, username:, password }
  setAuthentication(authentication) {}

  setEndpoint(url) {
    this._endpoint = url
  }

  sendRequest(serviceName, binding, operation, message) {
    let soapRequest = this.generateSoapMessage(message)
    let soapAction = this._services[serviceName][binding][operation].action
    let headers = {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(soapRequest),
      Accept: 'text/xml',
      SOAPAction: soapAction
    }

    return _httpPostString(this._endpoint, soapRequest, headers)
      .then(soapResponseXml => {
        let response = xmlExact.fromXml(soapResponseXml, this._soapDefinition)
        return response.Envelope.Body
      })
      .catch(error => {
        console.info(error)
      })
  }

  generateSoapMessage(message) {
    return xmlExact.toXml(
      {
        Envelope: {
          Header: '',
          Body: message
        }
      },
      'Envelope',
      this._soapDefinition
    )
  }

  generateSampleRequest(service, binding, operation) {
    let typeName = this._services[service][binding][operation].input.replace(
      /^[^:]+:/,
      ''
    )
    return xmlExact.generateSample(typeName, this._soapDefinition.Envelope.Body)
  }

  generateSampleResponse(service, binding, operation) {
    let typeName = this._services[service][binding][operation].output.replace(
      /^[^:]+:/,
      ''
    )
    return xmlExact.generateSample(typeName, this._soapDefinition.Envelope.Body)
  }

  getXsdSchema() {
    return this._xsdSchema
  }

  // { serviceName: { binding: { operation: { input: "messageName", output: "messageName" )
  getServices() {
    return this._services
  }
}

function _httpPostString(url, data, headers = null) {
  return new Promise(function(resolve, reject) {
    const curl = urlParser.parse(url)
    const requestOptions = {
      host: curl.hostname,
      port: curl.port,
      path: curl.path,
      method: 'POST',
      withCredentials: false,
      headers: headers
    }
    let req = http.request(requestOptions, res => {
      let responseContent = ''
      res.setEncoding('utf8')
      res.on('data', function(chunk) {
        responseContent += chunk
      })
      res.on('end', function() {
        if (res.statusCode === 200) {
          resolve(responseContent)
        } else {
          reject({
            error: `POST request '${url}' returned status code ${res.statusCode}`,
            data: responseContent
          })
        }
      })
    })
    req.on('error', e => {
      console.log(`problem with request: ${e.message}`)
    })
    req.write(data)
    req.end()
  })
}

function _httpGetString(url) {
  const curl = urlParser.parse(url)
  return new Promise(function(resolve, reject) {
    const req = http.request(
      {
        host: curl.hostname,
        port: curl.port,
        path: curl.path,
        method: 'GET',
        withCredentials: false // this is the important part
      },
      res => {
        let responseContent = ''
        res.setEncoding('utf8')
        res.on('data', function(chunk) {
          responseContent += chunk
        })
        res.on('end', function() {
          if (res.statusCode === 200) {
            resolve(responseContent)
          } else {
            reject({
              error: `GET request '${url}' returned status code ${res.statusCode}`,
              data: responseContent
            })
          }
        })
      }
    )

    req.on('error', e => {
      console.log(`problem with request: ${e.message}`)
    })

    req.end()
  })
}

function _extractServices(wsdlObj) {
  const result = {}
  if (!wsdlObj.service) return
  wsdlObj.service.forEach(function(service) {
    result[service.$name] = {}
    service.port.forEach(function(port) {
      let bindingName = port.$binding.replace(/^[^:]+:/, '') // Remove namespace
      if (result[service.$name][bindingName]) return // Skip if we already have this binding

      let binding = wsdlObj.binding.filter(function(binding) {
        return binding.$name === bindingName
      })[0]

      let portTypeName = binding.$type.replace(/^[^:]+:/, '') // Remove namespace
      let portType = wsdlObj.portType.filter(function(portType) {
        return portType.$name === portTypeName
      })[0]

      result[service.$name][bindingName] = {}
      portType.operation.forEach(function(portTypeOperation) {
        result[service.$name][bindingName][portTypeOperation.$name] = {}

        let bindingOperation = binding.operation.filter(function(operation) {
          return operation.$name === portTypeOperation.$name
        })[0]

        result[service.$name][bindingName][portTypeOperation.$name]['action'] =
          bindingOperation.operation.$soapAction

        let inputMessageName = portTypeOperation.input.$message.replace(
          /^[^:]+:/,
          ''
        ) // Remove namespace
        let inputMessage = wsdlObj.message.filter(function(message) {
          return message.$name === inputMessageName
        })[0]
        result[service.$name][bindingName][portTypeOperation.$name]['input'] =
          inputMessage.part[0].$element

        let outputMessageName = portTypeOperation.output.$message.replace(
          /^[^:]+:/,
          ''
        ) // Remove namespace
        let outputMessage = wsdlObj.message.filter(function(message) {
          return message.$name === outputMessageName
        })[0]
        result[service.$name][bindingName][portTypeOperation.$name]['output'] =
          outputMessage.part[0].$element
      })
    })
  })
  return result
}

module.exports = SoapUtils
