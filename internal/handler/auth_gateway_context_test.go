package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/Tencent/WeKnora/internal/types"
)

func TestGetGatewayContextReturnsOnlyAuthorizationContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/", func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), types.TenantIDContextKey, uint64(7))
		ctx = types.WithTenantAPIKeyScope(ctx, types.TenantAPIKeyScope{
			KeyID: 9, FullAccess: false, ScopeType: types.APIKeyScopeTenant,
			KnowledgeBaseIDs: types.StringArray{"kb-1"},
			Capabilities:     types.StringArray{"retrieve", "chat"},
		})
		ctx = types.WithPrincipal(ctx, types.Principal{Type: types.PrincipalAPIExternalUser, ID: "7:42"})
		c.Request = c.Request.WithContext(ctx)
		(&AuthHandler{}).GetGatewayContext(c)
	})

	response := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(response, req)

	require.Equal(t, http.StatusOK, response.Code)
	require.Contains(t, response.Body.String(), `"full_access":false`)
	require.Contains(t, response.Body.String(), `"knowledge_base_ids":["kb-1"]`)
	var body map[string]any
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	data := body["data"].(map[string]any)
	principal := data["principal"].(map[string]any)
	require.Equal(t, "api_external_user", principal["type"])
	require.Equal(t, "7:42", principal["id"])
	require.NotContains(t, response.Body.String(), "api_key")
}
