package swo

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/stdlib"
	"github.com/target/goalert/app/lifecycle"
	"github.com/target/goalert/swo/swogrp"
	"github.com/target/goalert/swo/swomsg"
	"github.com/target/goalert/util/log"
)

type Manager struct {
	// sql.DB instance safe for the application to use (instrumented for safe SWO operation)
	dbApp  *sql.DB
	dbMain *sql.DB
	dbNext *sql.DB

	pauseResume lifecycle.PauseResumer

	Config

	grp *swogrp.Group
}

type Node struct {
	ID uuid.UUID

	OldValid bool
	NewValid bool
	CanExec  bool

	Status string
}

type Config struct {
	OldDBC, NewDBC driver.Connector
	CanExec        bool
	Logger         *log.Logger
}

func NewManager(cfg Config) (*Manager, error) {
	m := &Manager{
		Config: cfg,
		dbApp:  sql.OpenDB(NewConnector(cfg.OldDBC, cfg.NewDBC)),
		dbMain: sql.OpenDB(cfg.OldDBC),
		dbNext: sql.OpenDB(cfg.NewDBC),
	}

	ctx := cfg.Logger.BackgroundContext()
	mainLog, err := swomsg.NewLog(ctx, m.dbMain)
	if err != nil {
		return nil, err
	}
	nextLog, err := swomsg.NewLog(ctx, m.dbNext)
	if err != nil {
		return nil, err
	}

	m.grp = swogrp.NewGroup(swogrp.Config{
		CanExec: cfg.CanExec,

		Logger:  cfg.Logger,
		MainLog: mainLog,
		NextLog: nextLog,

		ResetFunc:   m.DoReset,
		ExecuteFunc: m.DoExecute,
		PauseFunc:   m.DoPause,
		ResumeFunc:  m.DoResume,
	})

	return m, nil
}

func (m *Manager) DoPause(ctx context.Context) error {
	if m.pauseResume == nil {
		return errors.New("not initialized")
	}
	return m.pauseResume.Pause(ctx)
}

func (m *Manager) DoResume(ctx context.Context) error {
	if m.pauseResume == nil {
		return errors.New("not initialized")
	}
	return m.pauseResume.Resume(ctx)
}

func (m *Manager) Init(app lifecycle.PauseResumer) {
	if m.pauseResume != nil {
		panic("already set")
	}
	m.pauseResume = app
}

// withConnFromOld allows performing operations with a raw connection to the old database.
func (m *Manager) withConnFromOld(ctx context.Context, f func(context.Context, *pgx.Conn) error) error {
	return WithLockedConn(ctx, m.dbMain, f)
}

// withConnFromNew allows performing operations with a raw connection to the new database.
func (m *Manager) withConnFromNew(ctx context.Context, f func(context.Context, *pgx.Conn) error) error {
	return WithLockedConn(ctx, m.dbNext, f)
}

// withConnFromBoth allows performing operations with a raw connection to both databases database.
func (m *Manager) withConnFromBoth(ctx context.Context, f func(ctx context.Context, oldConn, newConn *pgx.Conn) error) error {
	// grab lock with old DB first
	return WithLockedConn(ctx, m.dbMain, func(ctx context.Context, connMain *pgx.Conn) error {
		return WithLockedConn(ctx, m.dbNext, func(ctx context.Context, connNext *pgx.Conn) error {
			return f(ctx, connMain, connNext)
		})
	})
}

func WithLockedConn(ctx context.Context, db *sql.DB, runFunc func(context.Context, *pgx.Conn) error) error {
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	return conn.Raw(func(driverConn interface{}) error {
		conn := driverConn.(*stdlib.Conn).Conn()
		err := SwitchOverExecLock(ctx, conn)
		if err != nil {
			return err
		}
		defer conn.Close(context.Background())
		defer UnlockConn(context.Background(), conn)

		return runFunc(ctx, conn)
	})
}

// Status will return the current switchover status.
func (m *Manager) Status() swogrp.Status { return m.grp.Status() }

// SendPing will ping all nodes in the cluster.
func (m *Manager) SendPing(ctx context.Context) error { return m.grp.Ping(ctx) }

// SendReset will trigger a reset of the switchover.
func (m *Manager) SendReset(ctx context.Context) error { return m.grp.Reset(ctx) }

// SendExecute will trigger the switchover to begin.
func (m *Manager) SendExecute(ctx context.Context) error { return m.grp.Execute(ctx) }

func (m *Manager) DB() *sql.DB { return m.dbApp }

type Status struct {
	Details string
	Nodes   []Node
}
