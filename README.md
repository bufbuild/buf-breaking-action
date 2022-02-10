# The `buf-breaking` Action

This [Action][actions] enables you to perform [breaking change detection][breaking] with
[Buf] in your GitHub Actions pipelines. If it detects breaking changes in a pull request, it
automatically creates inline comments where the change occurs.

![image](./static/img/breaking.png)

## Usage

Here's an example usage of The `buf-breaking` Action:

```yaml
on: pull_request
jobs:
  validate-protos:
    steps:
      - uses: actions/checkout@v2               # Run `git checkout`
      - uses: bufbuild/buf-setup-action@v0.5.0  # Install the `buf` CLI
      - uses: bufbuild/buf-breaking-action@v1   # Perform breaking change detection
        with:
          against: 'https://github.com/acme/weather.git#branch=main'
```

With this configuration, the Action detects breaking changes between the Protobuf sources in the
current branch against the `main` branch of the repository.

The `buf-breaking` Action is commonly used with the [`buf-push`][buf-push] Action, which can push
the current Input to the [Buf Schema Registry][bsr] (BSR) if no breaking change is detected. See the
[Push](#push) section below for more.

## Configuration

Parameter | Description | Required | Default
:---------|:------------|:---------|:-------
`input` | The [Input] path | | `.`
`against` | The reference to check compatibility against | ✅ |
`buf_input_https_username` | The username for the repository to check compatibility against. | | [`${{ github.actor }}`][context]
`buf_input_https_password` | The password for the repository to check compatibility against. | | [`${{ github.token }}`][context]
`buf_token` | The Buf [authentication token][token] used for private [Inputs][input]. | |

These parameters are derived from [`action.yml`](./action.yml).

For `buf-breaking-action` to run, the `buf` CLI needs to be installed first. We recommend using the
[`buf-setup`][buf-setup] Action to install it.

In most cases, you'll only need to configure several variables which are referenced in the examples
below. In these examples, we'll configure the action on the hypothetical `https://github.com/acme/weather.git` repository.

> **Note**: For the `buf-breaking-action` to detect changes successfully, both the `input` and the
* `against` must be buildable by the `buf` CLI. You can verify this locally using the
> [`buf build`][buf-build] command on both Inputs.

### Push

When we configure this action on `push`, we often need to update the reference to
check compatibility `against` so that we don't accidentally verify against the same
commit.

For example, if we want to run the `buf-breaking` action for all commits pushed to
the `main` branch, we'll need to update our `against` reference to refer to the
previous commit, i.e. `HEAD~1`.

```yaml
on:
  push:
    branches:
      - main
jobs:
  validate-protos:
    steps:
      - uses: actions/checkout@v2
      - uses: bufbuild/buf-setup-action@v0.5.0
      - uses: bufbuild/buf-breaking-action@v1
        with:
          against: 'https://github.com/acme/weather.git#branch=main,ref=HEAD~1'
```

### Inputs

Some repositories are structured so that their `buf.yaml` is defined
in a sub-directory alongside their Protobuf sources, such as a `proto/`
directory. In this case, you can specify the relative `input` path and
the `subdir` option in the `against` reference (this is relevant for
both `pull_request` and `push`).

```sh
$ tree
.
└── proto
    ├── acme
    │   └── weather
    │       └── v1
    │           └── weather.proto
    └── buf.yaml
```

```yaml
steps:
  - uses: actions/checkout@v2
  - uses: bufbuild/buf-setup-action@v0.5.0
  - uses: bufbuild/buf-breaking-action@v1
    with:
      input: 'proto'
      against: 'https://github.com/acme/weather.git#branch=main,ref=HEAD~1,subdir=proto'
```

The `buf-breaking` action is also commonly used alongside other `buf` actions,
such as [`buf-lint`][buf-lint] and [`buf-push`][buf-push].

[actions]: https://docs.github.com/actions
[breaking]: https:/docs.buf.build/breaking
[bsr]: https://docs.buf.build/bsr
[buf]: https://buf.build
[buf-build]: https://docs.buf.build/build/usage
[buf-lint]: https://github.com/marketplace/actions/buf-lint
[buf-push]: https://github.com/marketplace/actions/buf-push
[buf-setup]: https://github.com/marketplace/actions/buf-setup
[context]: https://docs.github.com/en/actions/learn-github-actions/contexts#github-context
[input]: https://docs.buf.build/reference/inputs
[token]: https://docs.buf.build/bsr/authentication#create-an-api-token
