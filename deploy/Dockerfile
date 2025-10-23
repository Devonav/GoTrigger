# Multi-stage build for Password Sync Server
FROM golang:1.24-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git make gcc musl-dev

# Copy go mod files
COPY ./go.mod ./go.sum ./
RUN go mod download

# Copy source code
COPY ./server ./server
COPY ./scripts ./scripts
COPY ./pkg ./pkg

# Build the server binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -ldflags="-w -s" -o password-sync-server ./server/cmd/main.go

# Final stage - minimal runtime image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata wget

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/password-sync-server .

# Copy schema for reference
COPY --from=builder /build/server/storage/postgres_schema.sql ./schema.sql

# Expose API port (8081 to avoid conflict with existing services)
EXPOSE 8081

# Run the server
ENTRYPOINT ["./password-sync-server"]
