extends Node
class_name ApiClient

const _Configuration := preload("configuration.gd")
const _ApiRequest := preload("request.gd")

var configuration: _Configuration

func _init(configuration: _Configuration):
	self.configuration = configuration

## Builds the headers for a request
func _build_headers() -> PackedStringArray:
	return [
		"Accept: application/json",
		"Content-Type: application/json",
	]

## Builds the complete URL to the backend
func _build_url(path: String) -> String:
	var path_segments := path.split("/", false)
	return self.configuration.endpoint + "/" + "/".join(path_segments)

## Creates a request
func _request(method: HTTPClient.Method, path: String, body: Dictionary) -> _ApiRequest:
	if !self.is_inside_tree():
		push_error("ApiClient node not added to tree, cannot make http requests")

	var url := self._build_url(path)
	var body_json := JSON.stringify(body)

	return _ApiRequest.new(self, method, url, { 
		"headers": self._build_headers(), 
		"body": body_json,
	})
