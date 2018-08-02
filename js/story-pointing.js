const project = 'IP';
const sprintNames = [
    "Sprint 1",
    "Sprint 2",
    "Sprint 3",
    "Sprint 4",
    "Sprint 5"/*,
    "Sprint 15",
    "Sprint 16",
    "Sprint 17",
    "Sprint 18"*/
];

document.addEventListener("DOMContentLoaded", function (event) {
    Promise.all(sprintNames.map(name => fetch('data/' + project + '-' + name + '-a.json').then(response => Promise.resolve(response.json())))).then(
        result => {
            let sprintsArr = result.map((sprint, i) => {
                sprint.key = sprintNames[i].replace("Sprint ", "");
                return sprint;
            });

            let sprint = sprintsArr[sprintsArr.length - 1];
            $('.issues').render(sprint.issues.filter(i => i.type == "Story").map(i => {
                return {key: i.key, pre: i.storyPoints, description: i.summary}
            }));

            $('.after select').on('change', function () {
                let tr = $(this).parents('tr');
                let pre = tr.find('.pre');
                pre.removeClass('text-hide');
                tr.addClass(pre.text() == $(this).val() ? "table-success" : "table-danger");
            })
        }
    )

});
