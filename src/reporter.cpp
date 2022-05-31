#include "reporter.hpp"

#include <filesystem>
#include <string>
#include <string_view>


constexpr std::string_view TIMELINE_TEMPLATE_BEGIN = R"(<html>
  <head>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load('current', {'packages':['timeline']});
      google.charts.setOnLoadCallback(drawChart);
      function drawChart() {
        var container = document.getElementById('timeline');
        var chart = new google.visualization.Timeline(container);
        var dataTable = new google.visualization.DataTable();

        dataTable.addColumn({ type: 'string', id: 'Executable' });
        dataTable.addColumn({ type: 'string', id: 'Title' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });
        dataTable.addRows([
)";

constexpr std::string_view TIMELINE_TEMPLATE_END = R"(])
        var options = {
          timeline: { colorByRowLabel: true },
          hAxis: {
            format: 'dd/MM HH:MM'
          },
        };

        chart.draw(dataTable, options);
      }
    </script>
  </head>
  <body>
    <div id="timeline" style="height: 100vh;"></div>
  </body>
</html>
)";

static std::string js_escape(std::string_view s) {
  std::string out;
  for (char c : s) {
    if (c == '\'' || c == '\\') {
      out.push_back('\\');
    }

    out.push_back(c);
  }

  return out;
}

TimeLineReporter::TimeLineReporter(std::ostream& stream) : m_stream(stream) {
  m_stream << TIMELINE_TEMPLATE_BEGIN;
}

TimeLineReporter::~TimeLineReporter() {
  m_stream << TIMELINE_TEMPLATE_END;
  m_stream.flush();
}

void TimeLineReporter::add(const ActivityEntry& activity) {
  const auto js_escape = [](std::string_view s) {
    std::string out;
    for (char c : s) {
      if (c == '\'' || c == '\\') {
        out.push_back('\\');
      }

      out.push_back(c);
    }

    return out;
  };

  const auto write_datetime = [](std::ostream& stream, TimePoint time) {
    const auto day_start = round_down<Days>(time);
    const auto date = Date(day_start);
    const auto time_of_day = TimeOfDay(time - day_start);

    stream << "new Date(" << static_cast<int>(date.year()) << ", "
           << (static_cast<unsigned>(date.month()) - 1) << ", " // months are indexed from 0 in JS
           << static_cast<unsigned>(date.day()) << ",";

    stream << time_of_day.hours().count() << ", "
           << time_of_day.minutes().count() << ", "
           << time_of_day.seconds().count() << ")";
  };

  m_stream << "['" << js_escape(activity.exe_name()) << "', ";
  m_stream << "'" << js_escape(activity.title) << "', ";
  write_datetime(m_stream, activity.begin);
  m_stream << ", ";
  write_datetime(m_stream, activity.end);
  m_stream << "],\n";
}


constexpr std::string_view PIE_TEMPLATE_BEGIN = R"(
<html>
  <head>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load("current", { packages: ["corechart"] });
      google.charts.setOnLoadCallback(drawChart);
      function drawChart() {
)";

constexpr std::string_view PIE_TEMPLATE_CHART_BEGIN = R"(
        var data = new google.visualization.DataTable()
        data.addColumn('string', 'Activity')
        data.addColumn('number', 'Seconds')
        data.addColumn({ type: 'string', role: 'tooltip' })
        data.addRows([

)";

constexpr std::string_view PIE_TEMPLATE_CHART_END = R"(
        ]);
        var options = {{
          title: '{}',
          pieHole: 0.4,
        }};

        var chart = new google.visualization.PieChart(document.getElementById('{}'));
        chart.draw(data, options);
)";

constexpr std::string_view PIE_TEMPLATE_CHARTS_END = R"(
      }
    </script>
  </head>
  <body>
)";

constexpr std::string_view PIE_TEMPLATE_END = R"(
  </body>
</html>
)";

PieReporter::PieReporter(
    std::ostream& stream,
    std::vector<std::pair<std::string, TimeRange>> ranges)
    : m_stream(stream) {
  for (auto&& [name, range] : ranges) {
    m_groups.emplace_back(std::move(name), range);
  }
}

void PieReporter::add(const ActivityEntry& activity) {
  for (auto& group : m_groups) {
    group.track(activity);
  }
}

void PieReporter::report_group(const StatsGroup& group) {
  using TrackedActivity = std::pair<std::string, Duration>;
  std::vector<TrackedActivity> activities(group.activities.begin(),
                                          group.activities.end());
  // sort by time tracked, descending
  std::sort(activities.begin(), activities.end(),
            [](const auto& left, const auto& right) {
              return left.second >= right.second;
            });

  m_stream << PIE_TEMPLATE_CHART_BEGIN;
  const auto total = static_cast<double>(
      std::chrono::duration_cast<Seconds>(group.total).count());

  for (const auto& [activity, duration] : activities) {
    const auto seconds = std::chrono::duration_cast<Seconds>(duration).count();
    const auto percent = 100.0 * static_cast<double>(seconds) / total;
    const auto tooltip = std::format("{} - {} ({:.2}%)", activity,
                                     to_humantime(duration, " "), percent);
    m_stream << std::format("['{}', {}, '{}'], \n", js_escape(activity),
                            seconds, js_escape(tooltip));
  }

  const auto title = std::format("{} ({})", group.name, to_humantime(group.total, " "));
  const auto& id = group.name;
  m_stream << std::format(PIE_TEMPLATE_CHART_END, title, id);
}

PieReporter::~PieReporter() {
  m_stream << PIE_TEMPLATE_BEGIN;
  for (const auto& group : m_groups) {
    report_group(group);
  }
  m_stream << PIE_TEMPLATE_CHARTS_END;

  for (const auto& group : m_groups) {
    m_stream << std::format(
        R"(<div id="{}" style = "width: 900px; height: 500px;"></div>)",
        group.name);
  }

  m_stream << PIE_TEMPLATE_END;
  m_stream.flush();
}