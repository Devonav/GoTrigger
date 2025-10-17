package errors

import "errors"

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrTokenExpired     = errors.New("token expired")
	ErrUserNotFound     = errors.New("user not found")
	ErrEmailExists      = errors.New("email already exists")
	ErrWeakPassword     = errors.New("password does not meet requirements")
	ErrDeviceNotTrusted = errors.New("device not trusted")
)
