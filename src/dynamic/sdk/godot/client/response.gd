extends RefCounted
## A response from the server. Contains the result, response code, headers, and body.
## The body is a dictionary of the JSON response.
## 
## @experimental

## The result of the request. 0 is success, 1 is failure.
var result: HTTPClient.Status

## The response code from the server.
var response_code: HTTPClient.ResponseCode

## The headers from the server.
var headers: PackedStringArray

## The body of the response, as a JSON dictionary, could be a null.
var body: Variant

func _init(result: int, response_code: int, headers: PackedStringArray, response_body: PackedByteArray) -> void:
	self.result = result
	self.response_code = response_code
	self.headers = headers
	
	var json = JSON.new()
	json.parse(response_body.get_string_from_utf8())
	body = json.get_data()
