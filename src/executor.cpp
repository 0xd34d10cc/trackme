#include "executor.hpp"

#include <thread>


void Executor::spawn(TaskFn fn) {
  spawn_at(Clock::now(), std::move(fn));
}

void Executor::spawn_at(TimePoint at, TaskFn fn) {
  m_tasks.emplace(Task{ at, std::move(fn) });
}

void Executor::spawn_delayed(Duration delay, TaskFn fn) {
  spawn_at(Clock::now() + delay, std::move(fn));
}

void Executor::spawn_periodic(Duration period, TaskFn fn) {
  spawn_periodic_at(Clock::now() + period, period, std::move(fn));
}

void Executor::spawn_periodic_at(TimePoint at, Duration period, TaskFn fn) {
  auto next = at + period;
  spawn_at(at, [this, next, period, f{ std::move(fn) }] () mutable {
    f();

    spawn_periodic_at(next, period, std::move(f));
  });
}

int Executor::run() {
  return run(TimePoint::max());
}

int Executor::run(TimePoint deadline) {
  m_running = true;
  int ticks = 0;
  auto now = Clock::now();
  while (m_running) {
    while (!m_tasks.empty() && m_tasks.top().execute_at < now) {
      m_tasks.top().fn();
      m_tasks.pop();

      ++ticks;
    }

    now = Clock::now();
    if (!m_running || m_tasks.empty() || now >= deadline) {
      break;
    }

    const auto wait_till = m_tasks.top().execute_at;
    if (wait_till >= deadline) {
      break;
    }

    if (wait_till < now) {
      continue;
    }

    // TODO: wait on condvar to reduce stop() latency
    std::this_thread::sleep_for(wait_till - now);
    now = Clock::now();
  }

  return ticks;
}

void Executor::stop() {
  m_running = false;
}