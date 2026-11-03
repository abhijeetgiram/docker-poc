{{- define "docker-poc.backendImage" -}}
{{- printf "%s:%s" .Values.backend.image .Values.backend.tag -}}
{{- end }}
