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

TaskFn Executor::next_task() {
  if (!m_running || m_tasks.empty()) {
    return TaskFn();
  }

  const auto now = Clock::now();
  auto& task = m_tasks.top();
  if (task.execute_at <= now) {
    auto fn = task.fn;
    m_tasks.pop();
    return fn;
  }

  std::this_thread::sleep_for(task.execute_at - now);

  auto fn = m_tasks.top().fn;
  m_tasks.pop();
  return fn;
}

int Executor::run() {
  m_running = true;

  int ticks = 0;
  while (auto fn = next_task()) {
    fn();
    ++ticks;
  }

  return ticks;
}

void Executor::stop() {
  m_running = false;
}