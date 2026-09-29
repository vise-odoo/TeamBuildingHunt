import json
import csv

for name in ['locations', 'routes']:

    with open(name + '.json') as jf:
        json_data = json.load(jf)

    csv_file = open(name + '.csv', 'w')
    csv_writer = csv.writer(csv_file)

    column = 0

    for emp in json_data:
        if column == 0:
            header = emp.keys()
            csv_writer.writerow(header)
            column += 1
        csv_writer.writerow(emp.values())
    csv_file.close()
