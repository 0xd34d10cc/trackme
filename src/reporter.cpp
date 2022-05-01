#include "reporter.hpp"

#include <filesystem>
#include <string>
#include <string_view>


constexpr std::string_view TEMPLATE_BEGIN = R"(<html>
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

constexpr std::string_view TEMPLATE_END = R"(])

        chart.draw(dataTable);
      }
    </script>
  </head>
  <body>
    <div id="timeline" style="height: 100vh;"></div>
  </body>
</html>
)";

Reporter::Reporter(std::ostream& stream) : m_stream(stream) {
  m_stream << TEMPLATE_BEGIN;
}

Reporter::~Reporter() {
  m_stream << TEMPLATE_END;
  m_stream.flush();
}

void Reporter::add(const ActivityEntry& activity) {
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
           << static_cast<unsigned>(date.month()) << ", "
           << static_cast<unsigned>(date.day()) << ",";

    stream << time_of_day.hours().count() << ", "
           << time_of_day.minutes().count() << ", "
           << time_of_day.seconds().count() << ")";
  };

  const auto exe_filename =
      std::filesystem::path(activity.executable).filename().string();

  m_stream << "['" << js_escape(exe_filename) << "', ";
  m_stream << "'" << js_escape(activity.title) << "', ";
  write_datetime(m_stream, activity.begin);
  m_stream << ", ";
  write_datetime(m_stream, activity.end);
  m_stream << "],\n";
}