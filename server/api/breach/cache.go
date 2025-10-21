package breach

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
	ctx         = context.Background()
)

// InitRedis initializes the Redis client
func InitRedis(addr string) error {
	redisClient = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	// Test connection
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %v", err)
	}

	fmt.Println("✅ Redis connected for breach report caching")
	return nil
}

// CloseRedis closes the Redis connection
func CloseRedis() error {
	if redisClient != nil {
		return redisClient.Close()
	}
	return nil
}

// GetCachedBreachReport retrieves a cached breach report for an email
func GetCachedBreachReport(email string) (*LeakResponse, error) {
	if redisClient == nil {
		return nil, fmt.Errorf("Redis client not initialized")
	}

	key := fmt.Sprintf("breach:email:%s", email)
	val, err := redisClient.Get(ctx, key).Result()

	if err == redis.Nil {
		// Cache miss
		return nil, nil
	} else if err != nil {
		// Redis error
		return nil, err
	}

	// Cache hit - deserialize
	var leakResp LeakResponse
	if err := json.Unmarshal([]byte(val), &leakResp); err != nil {
		return nil, fmt.Errorf("failed to deserialize cached breach report: %v", err)
	}

	fmt.Printf("🔥 Redis cache HIT for %s\n", email)
	return &leakResp, nil
}

// CacheBreachReport stores a breach report in Redis with TTL
func CacheBreachReport(email string, leakResp *LeakResponse, ttl time.Duration) error {
	if redisClient == nil {
		return fmt.Errorf("Redis client not initialized")
	}

	key := fmt.Sprintf("breach:email:%s", email)

	// Serialize to JSON
	data, err := json.Marshal(leakResp)
	if err != nil {
		return fmt.Errorf("failed to serialize breach report: %v", err)
	}

	// Store with TTL (default: 24 hours)
	if ttl == 0 {
		ttl = 24 * time.Hour
	}

	err = redisClient.Set(ctx, key, data, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to cache breach report: %v", err)
	}

	fmt.Printf("💾 Redis cache SET for %s (TTL: %v)\n", email, ttl)
	return nil
}

// InvalidateBreachCache removes cached breach report for an email
func InvalidateBreachCache(email string) error {
	if redisClient == nil {
		return fmt.Errorf("Redis client not initialized")
	}

	key := fmt.Sprintf("breach:email:%s", email)
	err := redisClient.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to invalidate cache: %v", err)
	}

	fmt.Printf("🗑️  Redis cache INVALIDATED for %s\n", email)
	return nil
}
