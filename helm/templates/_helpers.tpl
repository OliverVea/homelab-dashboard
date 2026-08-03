{{- define "dashboard.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dashboard.fullname" -}}
{{- printf "%s" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dashboard.labels" -}}
app.kubernetes.io/name: {{ include "dashboard.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "dashboard.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dashboard.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
