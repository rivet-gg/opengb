import { camelify, pascalify } from "../../types/case_conversions.ts";
import { exists, glob, resolve } from "../../deps.ts";
import { GeneratedCodeBuilder } from "../../build/gen/code_builder.ts";
import { Project } from "../../project/mod.ts";
import { dedent } from "../../build/deps.ts";

export async function generateUnityAddons(project: Project, sdkGenPath: string) {
	// Remove old backend
	await Deno.remove(resolve(sdkGenPath, "src", "Org.OpenAPITools", "Api", "BackendApi.cs"));
	await Deno.remove(resolve(sdkGenPath, "src", "Org.OpenAPITools.Test"), { recursive: true });

	await modifyApiClient(sdkGenPath);
	await modifyModels(project, sdkGenPath);
	await generateApiClient(project, sdkGenPath);
	await generateModuleApiClients(project, sdkGenPath);
}

async function modifyApiClient(sdkGenPath: string) {
	const path = resolve(sdkGenPath, "src", "Org.OpenAPITools", "Client", "ApiClient.cs");

	const content = await Deno.readTextFile(path);
	const fixedContent = content.replace("using UnityEngine;", "using UnityEngine;\nusing Newtonsoft.Json.Linq;").replace(
		"throw new ApiException((int)request.responseCode, request.error, text);",
		`
		var jsonBody = JObject.Parse(text);
		throw new ApiException((int)request.responseCode, request.error + " (" + jsonBody["message"] + ")", jsonBody);
		`,
	);

	// Write new runtime
	await Deno.writeTextFile(path, fixedContent);
}

// Move module name from type name into namespace
async function modifyModels(project: Project, sdkGenPath: string) {
	for (const mod of project.modules.values()) {
		const moduleNamePascal = pascalify(mod.name);

		for (const script of mod.scripts.values()) {
			const scriptNamePascal = pascalify(script.name);
			const stub = `${moduleNamePascal}${scriptNamePascal}`;

			const files = await glob.glob([`${stub}*.cs`], {
				cwd: resolve(sdkGenPath, "src", "Org.OpenAPITools", "Model"),
				ignore: "AbstractOpenAPISchema.cs",
				nodir: true,
			});

			for (const file of files) {
				const path = resolve(sdkGenPath, "src", "Org.OpenAPITools", "Model", file);

				const content = await Deno.readTextFile(path);
				const fixedContent = content
					.replace("Org.OpenAPITools.Model\n", `Org.OpenAPITools.Model.${moduleNamePascal}\n`)
					.replaceAll(stub, scriptNamePascal);

				await Deno.writeTextFile(path, fixedContent);
			}
		}
	}
}

async function generateApiClient(project: Project, sdkGenPath: string) {
	// Update index to only export our custom api
	const apiBuilder = new GeneratedCodeBuilder(resolve(sdkGenPath, "src", "Org.OpenAPITools", "Api", "Backend.cs"));

	const modules = apiBuilder.chunk;

	for (const mod of project.modules.values()) {
		const moduleNamePascal = pascalify(mod.name);
		const apiName = `${moduleNamePascal}Api`;

		modules.append`
			private ${apiName} _${mod.name};
			public ${apiName} ${moduleNamePascal} => _${mod.name} ??= new ${apiName}(this.AsynchronousClient, this.Configuration);
		`;
	}

	GeneratedCodeBuilder.wrap(
		apiClassTemplate("Backend"),
		modules,
		`
			}
		}
		`,
	);

	await apiBuilder.write(false);
}

async function generateModuleApiClients(project: Project, sdkGenPath: string) {
	// Create dir for module apis
	try {
		await Deno.mkdir(resolve(sdkGenPath, "src", "Org.OpenAPITools", "Api", "Modules"));
	} catch (e) {
		if (!(e instanceof Deno.errors.AlreadyExists)) {
			throw e;
		}
	}

	for (const mod of project.modules.values()) {
		const moduleNamePascal = pascalify(mod.name);

		// Create module api class
		const moduleApiBuilder = new GeneratedCodeBuilder(
			resolve(sdkGenPath, "src", "Org.OpenAPITools", "Api", "Modules", `${moduleNamePascal}.cs`),
		);

		const scripts = moduleApiBuilder.chunk;

		for (const script of mod.scripts.values()) {
			const scriptNamePascal = pascalify(script.name);
			const path = `/modules/${mod.name}/scripts/${script.name}/call`;

			const requestName = `${moduleNamePascal}${scriptNamePascal}Request`;
			const responseName = `${moduleNamePascal}${scriptNamePascal}Response`;
			const nsRequestName = `Org.OpenAPITools.Model.${moduleNamePascal}.${scriptNamePascal}Request`;
			const nsResponseName = `Org.OpenAPITools.Model.${moduleNamePascal}.${scriptNamePascal}Response`;

			// Generate missing free-form objects
			if (!await exists(resolve(sdkGenPath, "src", "Org.OpenAPITools", "Model", `${requestName}.cs`))) {
				await generateFreeFormInterface(
					moduleNamePascal,
					`${scriptNamePascal}Request`,
					`${mod.name}__${script.name}__Request`,
					resolve(sdkGenPath, "src", "Org.OpenAPITools", "Model", `${requestName}.cs`),
				);
			}
			if (!await exists(resolve(sdkGenPath, "src", "Org.OpenAPITools", "Model", `${responseName}.cs`))) {
				await generateFreeFormInterface(
					moduleNamePascal,
					`${scriptNamePascal}Response`,
					`${mod.name}__${script.name}__Response`,
					resolve(sdkGenPath, "src", "Org.OpenAPITools", "Model", `${responseName}.cs`),
				);
			}

			scripts.append`
				/// <summary>
				///  Call ${mod.name}.${script.name} script.
				/// </summary>
				/// <exception cref="Org.OpenAPITools.Client.ApiException">Thrown when fails to make API call</exception>
				/// <param name="body"> (optional)</param>
				/// <param name="cancellationToken">Cancellation Token to cancel the request.</param>
				/// <returns>Task of ${nsResponseName}</returns>
				public async System.Threading.Tasks.Task<${nsResponseName}> ${scriptNamePascal}(${nsRequestName} ${
				camelify(requestName)
			} = default(${nsRequestName}), System.Threading.CancellationToken cancellationToken = default(System.Threading.CancellationToken))
				{
					var task = ${scriptNamePascal}WithHttpInfo(${camelify(requestName)}, cancellationToken);
		#if UNITY_EDITOR || !UNITY_WEBGL
					Org.OpenAPITools.Client.ApiResponse<${nsResponseName}> localVarResponse = await task.ConfigureAwait(false);
		#else
					Org.OpenAPITools.Client.ApiResponse<${nsResponseName}> localVarResponse = await task;
		#endif
					return localVarResponse.Data;
				}

				/// <summary>
				///  Call ${mod.name}.${script.name} script.
				/// </summary>
				/// <exception cref="Org.OpenAPITools.Client.ApiException">Thrown when fails to make API call</exception>
				/// <param name="body"> (optional)</param>
				/// <param name="cancellationToken">Cancellation Token to cancel the request.</param>
				/// <returns>Task of ApiResponse (${nsResponseName})</returns>
				public async System.Threading.Tasks.Task<Org.OpenAPITools.Client.ApiResponse<${nsResponseName}>> ${scriptNamePascal}WithHttpInfo(${nsRequestName} ${
				camelify(requestName)
			} = default(${nsRequestName}), System.Threading.CancellationToken cancellationToken = default(System.Threading.CancellationToken))
				{

					Org.OpenAPITools.Client.RequestOptions localVarRequestOptions = new Org.OpenAPITools.Client.RequestOptions();

					string[] _contentTypes = new string[] {
						"application/json"
					};

					// to determine the Accept header
					string[] _accepts = new string[] {
						"application/json"
					};


					var localVarContentType = Org.OpenAPITools.Client.ClientUtils.SelectHeaderContentType(_contentTypes);
					if (localVarContentType != null) localVarRequestOptions.HeaderParameters.Add("Content-Type", localVarContentType);

					var localVarAccept = Org.OpenAPITools.Client.ClientUtils.SelectHeaderAccept(_accepts);
					if (localVarAccept != null) localVarRequestOptions.HeaderParameters.Add("Accept", localVarAccept);

					localVarRequestOptions.Data = ${camelify(requestName)};


					// make the HTTP request

					var task = this.AsynchronousClient.PostAsync<${nsResponseName}>("${path}", localVarRequestOptions, this.Configuration, cancellationToken);

		#if UNITY_EDITOR || !UNITY_WEBGL
					var localVarResponse = await task.ConfigureAwait(false);
		#else
					var localVarResponse = await task;
		#endif

					if (this.ExceptionFactory != null)
					{
						Exception _exception = this.ExceptionFactory("${scriptNamePascal}", localVarResponse);
						if (_exception != null) throw _exception;
					}

					return localVarResponse;
				}
			`;
		}

		GeneratedCodeBuilder.wrap(
			apiClassTemplate(`${moduleNamePascal}Api`),
			scripts,
			`
				}
			}
			`,
		);

		await moduleApiBuilder.write(false);
	}
}

async function generateFreeFormInterface(moduleName: string, interfaceName: string, dataName: string, path: string) {
	const schemaBuilder = new GeneratedCodeBuilder(path);

	schemaBuilder.appendRaw(`
		using System;
		using System.Collections;
		using System.Collections.Generic;
		using System.Collections.ObjectModel;
		using System.Linq;
		using System.IO;
		using System.Runtime.Serialization;
		using System.Text;
		using System.Text.RegularExpressions;
		using Newtonsoft.Json;
		using Newtonsoft.Json.Converters;
		using Newtonsoft.Json.Linq;
		using OpenAPIDateConverter = Org.OpenAPITools.Client.OpenAPIDateConverter;

		namespace Org.OpenAPITools.Model.${moduleName}
		{
			/// <summary>
			/// ${interfaceName}
			/// </summary>
			[DataContract(Name = "${dataName}")]
			public partial class ${interfaceName}
			{
				/// <summary>
				/// Initializes a new instance of the <see cref="${interfaceName}" /> class.
				/// </summary>
				[JsonConstructorAttribute]
				public ${interfaceName}() { }

				/// <summary>
				/// Returns the string presentation of the object
				/// </summary>
				/// <returns>String presentation of the object</returns>
				public override string ToString()
				{
					StringBuilder sb = new StringBuilder();
					sb.Append("class ${interfaceName} {\\n");
					sb.Append("}\\n");
					return sb.ToString();
				}

				/// <summary>
				/// Returns the JSON string presentation of the object
				/// </summary>
				/// <returns>JSON string presentation of the object</returns>
				public virtual string ToJson()
				{
					return Newtonsoft.Json.JsonConvert.SerializeObject(this, Newtonsoft.Json.Formatting.Indented);
				}

			}
		}
	`);

	await schemaBuilder.write(false);
}

function apiClassTemplate(name: string) {
	return dedent`
		using System;
		using System.Collections.Generic;
		using System.Collections.ObjectModel;
		using System.Linq;
		using System.Net;
		using System.Net.Mime;
		using Org.OpenAPITools.Client;
		using Org.OpenAPITools.Model;

		namespace Org.OpenAPITools.Api
		{
			/// <summary>
			/// Represents a collection of functions to interact with the API endpoints
			/// </summary>
			public partial class ${name} : IDisposable
			{
				/// <summary>
				/// Initializes a new instance of the <see cref="${name}"/> class.
				/// **IMPORTANT** This will also create an instance of HttpClient, which is less than ideal.
				/// It's better to reuse the <see href="https://docs.microsoft.com/en-us/dotnet/architecture/microservices/implement-resilient-applications/use-httpclientfactory-to-implement-resilient-http-requests#issues-with-the-original-httpclient-class-available-in-net">HttpClient and HttpClientHandler</see>.
				/// </summary>
				/// <returns></returns>
				public ${name}() : this((string)null)
				{
				}

				/// <summary>
				/// Initializes a new instance of the <see cref="${name}"/> class.
				/// **IMPORTANT** This will also create an instance of HttpClient, which is less than ideal.
				/// It's better to reuse the <see href="https://docs.microsoft.com/en-us/dotnet/architecture/microservices/implement-resilient-applications/use-httpclientfactory-to-implement-resilient-http-requests#issues-with-the-original-httpclient-class-available-in-net">HttpClient and HttpClientHandler</see>.
				/// </summary>
				/// <param name="basePath">The target service's base path in URL format.</param>
				/// <exception cref="ArgumentException"></exception>
				/// <returns></returns>
				public ${name}(string basePath)
				{
					this.Configuration = Org.OpenAPITools.Client.Configuration.MergeConfigurations(
						Org.OpenAPITools.Client.GlobalConfiguration.Instance,
						new Org.OpenAPITools.Client.Configuration { BasePath = basePath }
					);
					this.ApiClient = new Org.OpenAPITools.Client.ApiClient(this.Configuration.BasePath);
					this.AsynchronousClient = this.ApiClient;
					this.ExceptionFactory = Org.OpenAPITools.Client.Configuration.DefaultExceptionFactory;
				}

				/// <summary>
				/// Initializes a new instance of the <see cref="${name}"/> class using Configuration object.
				/// **IMPORTANT** This will also create an instance of HttpClient, which is less than ideal.
				/// It's better to reuse the <see href="https://docs.microsoft.com/en-us/dotnet/architecture/microservices/implement-resilient-applications/use-httpclientfactory-to-implement-resilient-http-requests#issues-with-the-original-httpclient-class-available-in-net">HttpClient and HttpClientHandler</see>.
				/// </summary>
				/// <param name="configuration">An instance of Configuration.</param>
				/// <exception cref="ArgumentNullException"></exception>
				/// <returns></returns>
				public ${name}(Org.OpenAPITools.Client.Configuration configuration)
				{
					if (configuration == null) throw new ArgumentNullException("configuration");

					this.Configuration = Org.OpenAPITools.Client.Configuration.MergeConfigurations(
						Org.OpenAPITools.Client.GlobalConfiguration.Instance,
						configuration
					);
					this.ApiClient = new Org.OpenAPITools.Client.ApiClient(this.Configuration.BasePath);
					this.AsynchronousClient = this.ApiClient;
					ExceptionFactory = Org.OpenAPITools.Client.Configuration.DefaultExceptionFactory;
				}

				/// <summary>
				/// Initializes a new instance of the <see cref="${name}"/> class
				/// using a Configuration object and client instance.
				/// </summary>
				/// <param name="asyncClient">The client interface for asynchronous API access.</param>
				/// <param name="configuration">The configuration object.</param>
				/// <exception cref="ArgumentNullException"></exception>
				public ${name}(Org.OpenAPITools.Client.IAsynchronousClient asyncClient, Org.OpenAPITools.Client.IReadableConfiguration configuration)
				{
					if (asyncClient == null) throw new ArgumentNullException("asyncClient");
					if (configuration == null) throw new ArgumentNullException("configuration");

					this.AsynchronousClient = asyncClient;
					this.Configuration = configuration;
					this.ExceptionFactory = Org.OpenAPITools.Client.Configuration.DefaultExceptionFactory;
				}

				/// <summary>
				/// Disposes resources if they were created by us
				/// </summary>
				public void Dispose()
				{
					this.ApiClient?.Dispose();
				}

				/// <summary>
				/// Holds the ApiClient if created
				/// </summary>
				public Org.OpenAPITools.Client.ApiClient ApiClient { get; set; } = null;

				/// <summary>
				/// The client for accessing this underlying API asynchronously.
				/// </summary>
				public Org.OpenAPITools.Client.IAsynchronousClient AsynchronousClient { get; set; }

				/// <summary>
				/// Gets the base path of the API client.
				/// </summary>
				/// <value>The base path</value>
				public string GetBasePath()
				{
					return this.Configuration.BasePath;
				}

				/// <summary>
				/// Gets or sets the configuration object
				/// </summary>
				/// <value>An instance of the Configuration</value>
				public Org.OpenAPITools.Client.IReadableConfiguration Configuration { get; set; }

				private Org.OpenAPITools.Client.ExceptionFactory _exceptionFactory = (name, response) => null;

				/// <summary>
				/// Provides a factory method hook for the creation of exceptions.
				/// </summary>
				public Org.OpenAPITools.Client.ExceptionFactory ExceptionFactory
				{
					get
					{
						if (_exceptionFactory != null && _exceptionFactory.GetInvocationList().Length > 1)
						{
							throw new InvalidOperationException("Multicast delegate for ExceptionFactory is unsupported.");
						}
						return _exceptionFactory;
					}
					set { _exceptionFactory = value; }
				}
	`;
}
