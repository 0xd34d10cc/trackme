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
        var data = new google.visualization.DataTable()
        data.addColumn('string', 'Activity')
        data.addColumn('number', 'Seconds')
        data.addColumn({ type: 'string', role: 'tooltip' })
        data.addRows([
)";

constexpr std::string_view PIE_TEMPLATE_END = R"(
]);
        var options = {{
          title: 'Total time tracked: {}',
          pieHole: 0.4,
        }};

        var chart = new google.visualization.PieChart(document.getElementById('donutchart'));
        chart.draw(data, options);
      }}
    </script>
  </head>
  <body>
    <div id="donutchart" style="width: 900px; height: 500px;"></div>
  </body>
</html>
)";

PieReporter::PieReporter(std::ostream& stream) : m_stream(stream) {
  m_stream << PIE_TEMPLATE_BEGIN;
}

void PieReporter::add(const ActivityEntry& activity) {
  const auto spent = activity.end - activity.begin;
  m_activities[activity.exe_name()] += spent;
  m_total += spent;
}

PieReporter::~PieReporter() {
  std::vector<std::pair<std::string, Duration>> activities(m_activities.begin(),
                                                           m_activities.end());
  // sort by time tracked, descending
  std::sort(activities.begin(), activities.end(),
            [](const auto& left, const auto& right) {
              return left.second >= right.second;
            });

  const auto total = static_cast<double>(std::chrono::duration_cast<Seconds>(m_total).count());
  for (const auto& [activity, duration] : activities) {
    const auto seconds = std::chrono::duration_cast<Seconds>(duration).count();
    const auto percent = 100.0 * static_cast<double>(seconds) / total;
    const auto tooltip = std::format("{} - {} ({:.2}%)", activity,
                                     to_humantime(duration, " "), percent);
    m_stream << std::format("['{}', {}, '{}'], \n", js_escape(activity),
                            seconds, js_escape(tooltip));
  }

  m_stream << std::format(PIE_TEMPLATE_END, to_humantime(m_total, " "));
  m_stream.flush();
}