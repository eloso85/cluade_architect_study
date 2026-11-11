export const workflow = [
  {
    id: "A",
    name: "find_user_by_name",
    input: { name: "Leanne Graham" },
    dependencies: []
  },
  {
    id: "B",
    name: "get_posts_for_user",
    input: {},
    dependencies: ["A"]
  },
  {
    id: "C",
    name: "get_post_count_for_user",
    input: {},
    dependencies: ["A"]
  }
];